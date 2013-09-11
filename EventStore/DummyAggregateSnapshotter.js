/**
 * @module esdf/Test/DummyAggregateSnapshotter
 */

var when = require('when');
var AggregateSnapshot = require('../utils/AggregateSnapshot.js').AggregateSnapshot;

/*
 * Construct a new DummyAggregateSnapshotter. It can be used like any other snapshotter, to save and retrieve aggregate states.
 *  This is in contrast to Event Sinks, which store events, instead of resulting object states.
 *  The snapshotter is not required for operation, and serves as a performance optimization only.
 */
function DummyAggregateSnapshotter(){
	this._snapshots = {};
}

//TODO: documentation
//TODO: type enforcement on aggregateSnapshot
DummyAggregateSnapshotter.prototype.saveSnapshot = function saveSnapshot(aggregateSnapshot){
	var saveDeferred = when.defer();
	if(!AggregateSnapshot.isAggregateSnapshot(aggregateSnapshot)){
		return saveDeferred.resolver.reject(new Error('Object passed for saving is not a valid aggregate snapshot.'));
	}
	this._snapshots[aggregateID] = aggregateSnapshot;
	setImmediate(function(){
		saveDeferred.resolver.resolve();
	});
	return saveDeferred.promise;
};

DummyAggregateSnapshotter.prototype.loadSnapshot = function loadSnapshot(aggregateID){
	var loadDeferred = when.defer();
	setImmediate((function(){
		if(this._snapshots[aggregateID]){
			loadDeferred.resolver.resolve(this._snapshots[aggregateID]);
		}
		else{
			loadDeferred.resolver.reject(undefined);
		}
	}).bind(this));
	return loadDeferred.promise;
};