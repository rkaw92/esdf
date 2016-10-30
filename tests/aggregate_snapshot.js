'use strict';

const esdf = require('../');
const EventSourcedAggregate = esdf.core.EventSourcedAggregate;
const AggregateSnapshot = esdf.types.AggregateSnapshot;
const DummyAggregateSnapshotter = esdf.test.DummyAggregateSnapshotter;
const Event = esdf.core.Event;
const assert = require('assert');
const util = require('util');

// Has snapshot support.
function Snappy(){
	this._aggregateType = 'Snappy';
	this.ok = false;
	this.okID = undefined;
}
util.inherits(Snappy, EventSourcedAggregate);
Snappy.prototype.okay = function okay(okID){
	this._stageEvent(new Event('Okayed', {okID: okID}));
};
Snappy.prototype.onOkayed = function onOkayed(event, commit){
	this.ok = true;
	this.okID = event.eventPayload.id;
};
Snappy.prototype._getSnapshotData = function _getSnapshotData(){
	return {ok: this.ok, okID: this.okID};
};
Snappy.prototype._applySnapshot = function _applySnapshot(snapshot){
	for(var k in snapshot.aggregateData){
		this[k] = snapshot.aggregateData[k];
	}
};

// Does not really support snapshots.
function NotSoSnappy(){
	this._aggregateType = 'NotSoSnappy';
}
util.inherits(NotSoSnappy, EventSourcedAggregate);

describe('EventSourcedAggregate', function(){
	describe('#applySnapshot', function(){
		it('should update the aggregate state accordingly', function(){
			var aggr1 = new Snappy();
			aggr1.applySnapshot(new AggregateSnapshot('Snappy', 'dummy', {ok: true}, 1));
			assert.equal(aggr1.ok, true);
			assert.equal(aggr1.getNextSequenceNumber(), 2);
		});
		it('should fail to apply a snapshot to a non-supporting aggregate', function(){
			var aggr2 = new NotSoSnappy();
			try{
				aggr2.applySnapshot(new AggregateSnapshot('NotSoSnappy', 'dummy', {ok: true}, 1));
				throw new Error('applySnapshot worked!');
			}
			catch(err){
				// Check for the critical flag - a normal "Error" object will have none (in fact, it will have no "labels" property).
				assert.equal(err.labels.critical, true);
			}
		});
		it('should fail to apply a snapshot to an aggregate of a different type', function(){
			var aggr3 = new Snappy();
			try{
				aggr3.applySnapshot(new AggregateSnapshot('NotSoSnappy', 'dummy', {ok: true}, 1));
				throw new Error('Snapshot applied despite aggregateType mismatch!');
			}
			catch(err){
				assert.equal(err.labels.critical, true);
				// Check if the snapshot didn't get applied by mistake:
				assert.equal(aggr3.ok, false);
			}
		});
	});
	//TODO: Test snapshot saving/loading with a Repository. Possibly move this aspect to the Repository test file.
});