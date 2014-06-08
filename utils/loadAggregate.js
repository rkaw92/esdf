/**
 * @module esdf/utils/loadAggregate
 */

//TODO: Documentation.

var when = require('when');
var util = require('util');

/**
 * An EventSink has not been provided to the aggregate loader function. At least an EventSink is required - otherwise, Event Soutcing as such can not function.
 */
function AggregateLoaderSinkNotGivenError(){
	this.name = 'AggregateLoaderSinkNotGivenError';
	this.message = 'At least an EventSink needs to be passed to createAggregateLoader!';
}
util.inherits(AggregateLoaderSinkNotGivenError, Error);

function NoOpSnapshotter(){
	
}
NoOpSnapshotter.prototype.loadSnapshot = function loadSnapshot(ARType, ARID){
	return when.reject('Dummy no-op snapshotter - rejecting load promise. To use a real snapshotter, pass it to the loadAggregate function.');
};
NoOpSnapshotter.prototype.saveSnapshot = function saveSnapshot(snapshot){
	return when.reject('Dummy no-op snapshotter - rejecting save promise. To use a real snapshotter, pass it to the loadAggregate function.');
};

//TODO: Kill "cachers" with fire! They introduce complexity which is unwarranted, as we already have snapshotters that are more than fitting for the job.
// They can also cause infinite loops if a reload becomes necessary.
// If extremely low snapshot latencies are required (i.e. in-process caching), snapshotter composition should be used (snapshotter "tiers" layered behind a facade).
function NoOpCacher(){
	
}
NoOpCacher.prototype.getAggregateInstance = function getAggregateInstance(ARType, ARID){
	// We're a no-op - return undefined so that the caller knows we do not have the instance cached.
	return;
};
NoOpCacher.prototype.cacheAggregateInstance = function cacheAggregateInstance(instance){
	// Do nothing - we do not store anything in memory.
	return;
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
function loadAggregate(ARConstructor, ARID, eventSink, snapshotter, cacher){
	// Determine the aggregate type. The snapshot loader and/or the rehydrator (sink) may need this to find the data.
	var aggregateType = ARConstructor.prototype._aggregateType;
	// Function definitions for later use in loadAggregate:
	// Aggregate construction.
	function constructAggregate(){
		var ARObject = new ARConstructor();
		ARObject.setAggregateID(ARID);
		ARObject.setEventSink(eventSink);
		// If no snapshotter has been passed (or is not needed/used), instead of complicating logic, we simply replace it locally with a stub that knows no aggregates and rejects all loads.
		//  This happens in constructAggregate since it relies on the AR object existing.
		if(!snapshotter || !ARObject.supportsSnapshotApplication()){
			snapshotter = new NoOpSnapshotter();
		}
		ARObject.setSnapshotter(snapshotter);
		return ARObject;
	}
	
	var cacheProvider = cacher || new NoOpCacher();
	
	// Rehydration. It will resolve the top-level promise for us, so that there is no need to call anything else to finish the loading.
	function rehydrateAggregate(ARObject){
		return when.try(eventSink.rehydrate.bind(eventSink), ARObject, ARID, ARObject.getNextSequenceNumber());
	}
	
	// Nominal loading function - in case the aggregate is not in the aggregate cache:
	function nominalLoad(){
		// Actual retrieval/construction/rehydration:
		var ARObject = constructAggregate();
		return when.try(snapshotter.loadSnapshot.bind(snapshotter), aggregateType, ARID).then(function _applySnapshot(snapshot){
			// A snapshot has been found and loaded, so let the AR apply it to itself, according to its internal logic.
			return when.try(ARObject.applySnapshot.bind(ARObject), snapshot);
		}, function _snapshotNonexistent(){
			// This function intentionally does nothing. It simply turns a rejection from loadSnapshot() into a resolution.
		}).then(rehydrateAggregate.bind(undefined, ARObject)).then(function(){
			return ARObject;
		});
	}
	
	// If the aggregate instance is in the cache, we can use a much simpler procedure.
	function cacheLoad(){
		return cacheProvider.getAggregateInstance(aggregateType, ARID);
	}
	
	// Finally, put the defined procedures to action:
	var instance = cacheLoad();
	if(instance){
		// We've got what we came for: a ready instance.
		return when.resolve(instance);
	}
	else{
		return nominalLoad().then(function(loadedAggregate){
			// Now that the aggregate has been (tediously) loaded from our store, ask the cacher to cache it for further use.
			cacheProvider.cacheAggregateInstance(loadedAggregate);
			return loadedAggregate;
		});
	}
}

//TODO: Document the "cacher" argument.
/**
 * Create a closure that will subsequently load any AR, without specifying the event sink and snapshotter each time.
 * This function simply binds the two last arguments of the loader function to specified values and returns the bound function.
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink  The event sink to be used by the generated loader function.
 * @param {module:esdf/interfaces/AggregateSnapshotterInterface} [snapshotter] The snapshotter to be used. If not passed, aggregate loading will occur using only the event sink.
 * @returns {module:esdf/utils/loadAggregate~loadAggregate}
 * @throws {module:esdf/utils/loadAggregate~AggregateLoaderSinkNotGivenError} If an eventSink is not passed to the loader creation function.
 */
function createAggregateLoader(eventSink, snapshotter, cacher){
	if(!eventSink){
		throw new AggregateLoaderSinkNotGivenError();
	}
	return function _boundAggregateLoader(ARConstructor, ARID){
		return loadAggregate(ARConstructor, ARID, eventSink, snapshotter, cacher);
	};
}

module.exports.loadAggregate = loadAggregate;
module.exports.createAggregateLoader = createAggregateLoader;