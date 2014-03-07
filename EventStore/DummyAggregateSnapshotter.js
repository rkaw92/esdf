/**
 * @module esdf/test/DummyAggregateSnapshotter
 */

var when = require('when');
var util = require('util');
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
DummyAggregateSnapshotter.prototype.saveSnapshot = function saveSnapshot(aggregateSnapshot){
	var saveDeferred = when.defer();
	var aggregateKey = aggregateSnapshot.aggregateType + ':' + aggregateSnapshot.aggregateID;
	if(!AggregateSnapshot.isAggregateSnapshot(aggregateSnapshot)){
		return saveDeferred.resolver.reject(new Error('Object passed for saving is not a valid aggregate snapshot. Dump: ' + util.inspect(aggregateSnapshot)));
	}
	this._snapshots[aggregateKey] = aggregateSnapshot;
	setImmediate(function(){
		saveDeferred.resolver.resolve();
	});
	return saveDeferred.promise;
};

//TODO: enrich this signature to include aggregate types - different classes may require different backing storage.
DummyAggregateSnapshotter.prototype.loadSnapshot = function loadSnapshot(aggregateType, aggregateID){
	var loadDeferred = when.defer();
	var aggregateKey = aggregateType + ':' + aggregateID;
	setImmediate((function(){
		if(AggregateSnapshot.isAggregateSnapshot(this._snapshots[aggregateKey])){
			loadDeferred.resolver.resolve(this._snapshots[aggregateKey]);
		}
		else{
			loadDeferred.resolver.reject(undefined);
		}
	}).bind(this));
	return loadDeferred.promise;
};

module.exports.DummyAggregateSnapshotter = DummyAggregateSnapshotter;