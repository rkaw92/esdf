/**
 * @module esdf/utils/loadAggregate
 */

var when = require('when');

function NoOpSnapshotter(){
	
}
NoOpSnapshotter.prototype.loadSnapshot = function loadSnapshot(ARID){
	return when.reject('Dummy no-op snapshotter - rejecting load promise. To use a real snapshotter, pass it to the loadAggregate function.');
};
NoOpSnapshotter.prototype.saveSnapshot = function saveSnapshot(snapshot){
	return when.reject('Dummy no-op snapshotter - rejecting save promise. To use a real snapshotter, pass it to the loadAggregate function.');
};

/**
 * Load an EventSourcedAggregate using an EventSink, assisted by a Snapshotter for increased performance (optional). This operation performs rehydration under the hood - if a snapshot is found, rehydration is done since that snapshot.
 *  Note that loading an empty Aggregate, that is, one that has zero commits, is a valid operation by design. In such case, the AR returned will be in its initial state, right after its constructor is called.
 *  Loading empty ARs is also the preferred method of creating new instances of any domain objects (simply generate a random ARID and load it).
 * @param {function} ARConstructor The Aggregate's constructor. Called via new, without any parameters.
 * @param {string} ARID Aggregate ID, used for loading the snapshot and the event stream.
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink The EventSink used for rehydration. If a snapshotter is provided, it is only asked for commits "since" the snapshot.
 * @param {module:esdf/interfaces/AggregateSnapshotterInterface} [snapshotter] The snapshot provider to use when loading, to optimize loading times and lower system load. By default, only rehydration via EventSink is used.
 * @returns {external:Promise} a promise that resolves with the Aggregate as resolution value if loading succeeded, and rejects with a passed-through error if failed. If snapshot loading fails, the aggregate is rehydrated from events and the loading can still succeed.
 */
//TODO: Insert instrumentation probes to indicate when a snapshotter is not used (attempted) at all, to aid performance troubleshooting.
function loadAggregate(ARConstructor, ARID, eventSink, snapshotter){
	// Initialize the promise we're going to return to the caller.
	var loadDeferred = when.defer();
	// Initialize the AR we're going to be populating using the provided constructor function.
	var ARObject;
	function _constructAggregate(){
		ARObject = new ARConstructor();
		ARObject.setAggregateID(ARID);
		ARObject.setEventSink(eventSink);
		// If no snapshotter has been passed (or is not needed/used), instead of complicating logic, we simply replace it locally with a stub that knows no aggregates and rejects all loads.
		//  This happens in _constructAggregate since it relies on the AR object existing.
		if(!snapshotter || !ARObject.supportsSnapshots()){
			snapshotter = new NoOpSnapshotter();
		}
		ARObject._snapshotter = snapshotter;
	}
	_constructAggregate();
	
	// Define the rehydration function. It will resolve the top-level promise for us, so that there is no need to call anything else to finish the loading.
	function _rehydrateAggregate(sinceCommit){
		when(eventSink.rehydrate(ARObject, ARID, sinceCommit),
				function _aggregateRehydrated(){
					loadDeferred.resolver.resolve(ARObject);
				},
				loadDeferred.resolver.reject,
				loadDeferred.resolver.notify
		);
	}
	
	when(snapshotter.loadSnapshot(ARID),
	function _snapshotLoaded(snapshot){
		// A snapshot has been found and loaded, so let the AR apply it to itself, according to its internal logic.
		try{
			when(ARObject.applySnapshot(snapshot),
			function _snapshotApplied(){
				// The object is already partially rehydrated, so we need to skip some events when starting rehydration.
				_rehydrateAggregate(ARObject.getNextSequenceNumber());
			},
			function _snapshotNotApplied(){
				// Snapshot application failed - we should now rehydrate from the start, using all commits since the first one.
				//  Thus, we construct the object anew to avoid operating on unclean state.
				_constructAggregate();
				_rehydrateAggregate(1);
			},
			loadDeferred.resolver.notify
			);
		}
		catch(e){
			// Snapshot not applied - same as above.
			_constructAggregate();
			_rehydrateAggregate(1);
		}
	},
	function _snapshotNotLoaded(){
		// We could not load a snapshot, so apply all events instead.
		_rehydrateAggregate(1);
	},
	loadDeferred.resolver.notify);
	
	return loadDeferred.promise;
}

/**
 * Create a closure that will subsequently load any AR, without specifying the event sink and snapshotter each time.
 * This function simply binds the two last arguments of the loader function to specified values and returns the bound function.
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink  The event sink to be used by the generated loader function.
 * @param {module:esdf/interfaces/AggregateSnapshotterInterface} [snapshotter] The snapshotter to be used. If not passed, aggregate loading will occur using only the event sink.
 * @returns {module:esdf/utils/loadAggregate~loadAggregate}
 */
function createAggregateLoader(eventSink, snapshotter){
	return function _boundAggregateLoader(ARConstructor, ARID){
		return loadAggregate(ARConstructor, ARID, eventSink, snapshotter);
	};
}

module.exports.loadAggregate = loadAggregate;
module.exports.createAggregateLoader = createAggregateLoader;