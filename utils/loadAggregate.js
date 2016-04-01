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

/**
 * Load an EventSourcedAggregate using an EventSink, assisted by a Snapshotter for increased performance (optional). This operation performs rehydration under the hood - if a snapshot is found, rehydration is done since that snapshot.
 *  Note that loading an empty Aggregate, that is, one that has zero commits, is a valid operation by design. In such case, the AR returned will be in its initial state, right after its constructor is called.
 *  Loading empty ARs is also the preferred method of creating new instances of any domain objects (simply generate a random ARID and load it).
 * @param {function} ARConstructor The Aggregate's constructor. Called via new, without any parameters.
 * @param {string} ARID Aggregate ID, used for loading the snapshot and the event stream.
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink The EventSink used for rehydration. If a snapshotter is provided, it is only asked for commits "since" the snapshot.
 * @param {module:esdf/interfaces/AggregateSnapshotterInterface} [snapshotter] The snapshot provider to use when loading, to optimize loading times and lower system load. By default, only rehydration via EventSink is used.
 * @param {Object} [options] - Optional settings that change the behaviour of the loader.
 * @param {boolean} [options.advanced] - Whether an "advanced format" promise resolution value is desired, rather than just the aggregate instance.
 * @returns {external:Promise} a promise that resolves with the Aggregate as resolution value if loading succeeded, and rejects with a passed-through error if failed. If snapshot loading fails, the aggregate is rehydrated from events and the loading can still succeed.
 */
//TODO: Insert instrumentation probes to indicate when a snapshotter is not used (attempted) at all, to aid performance troubleshooting.
function loadAggregate(ARConstructor, ARID, eventSink, snapshotter, options) {
	options = options || {};
	
	// Pick a default value for the diffSince option ("compute difference since commit number") if required:
	var diffSince;
	if (typeof(options.diffSince) === 'number' && !isNaN(options.diffSince)) {
		diffSince = options.diffSince;
	}
	else {
		// No commits' slot numbers are greater than infinity. Thus, by default, the diff will be empty.
		diffSince = Infinity;
	}
	
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
	
	function rehydrateAggregate(ARObject) {
		// We need to load the aggregate's events since the earlier of the two points: diffSince and the initial state as obtained from e.g. a snapshot.
		// However, we will only be applying those events which are actually newer than the current state. Some will simply be gathered and returned informationally as requested.
		var loadFromSlot = Math.min(ARObject.getNextSequenceNumber(), diffSince + 1);
		//TODO: Optionally limit the length of returned diffs by computing the difference between loadFromSlot and ARObject.getNextSequenceNumber() as a DoS prevention measure.
		// Obtain a stream of commits that we will be processing one by one:
		var commitStream = eventSink.getCommitStream(ARID, loadFromSlot);
		
		// Process the stream:
		var diffCommits = [];
		
		return when.promise(function(resolve, reject) {
			commitStream.on('data', function processStreamedCommit(commit) {
				try {
					// Only apply those commits which have not been applied already to the aggregate root's state:
					if (commit.sequenceSlot >= ARObject.getNextSequenceNumber()) {
						ARObject.applyCommit(commit);
					}
					// If we've moved above the "diffSince" moment, everything since then is a difference, so add it to the list:
					if (commit.sequenceSlot > diffSince) {
						diffCommits.push(commit);
					}
				}
				catch (error) {
					reject(error);
				}
			});
			
			commitStream.on('end', function() {
				resolve({
					diffCommits: diffCommits
				});
			});
		});
	}
	
	var ARObject = constructAggregate();
	return when.try(snapshotter.loadSnapshot.bind(snapshotter), aggregateType, ARID).then(function _applySnapshot(snapshot){
		// A snapshot has been found and loaded, so let the AR apply it to itself, according to its internal logic.
		return when.try(ARObject.applySnapshot.bind(ARObject), snapshot);
	}, function _snapshotNonexistent() {
		// This function intentionally does nothing. It simply turns a rejection from loadSnapshot() into a resolution.
		//TODO: Put an event-emitting statement here once we have logging support in place.
	}).then(rehydrateAggregate.bind(undefined, ARObject)).then(function(rehydrationResult) {
		if (options.advanced) {
			return {
				instance: ARObject,
				rehydration: rehydrationResult
			};
		}
		else {
			return ARObject;
		}
	});
}

/**
 * Create a closure that will subsequently load any AR, without specifying the event sink and snapshotter each time.
 * This function simply binds the two last arguments of the loader function to specified values and returns the bound function.
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink  The event sink to be used by the generated loader function.
 * @param {module:esdf/interfaces/AggregateSnapshotterInterface} [snapshotter] The snapshotter to be used. If not passed, aggregate loading will occur using only the event sink.
 * @returns {module:esdf/utils/loadAggregate~loadAggregate}
 * @throws {module:esdf/utils/loadAggregate~AggregateLoaderSinkNotGivenError} If an eventSink is not passed to the loader creation function.
 */
function createAggregateLoader(eventSink, snapshotter) {
	if(!eventSink){
		throw new AggregateLoaderSinkNotGivenError();
	}
	return function _boundAggregateLoader(ARConstructor, ARID, options) {
		return loadAggregate(ARConstructor, ARID, eventSink, snapshotter, options);
	};
}

module.exports.loadAggregate = loadAggregate;
module.exports.createAggregateLoader = createAggregateLoader;
