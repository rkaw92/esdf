var EventSourcedAggregate = require('../EventSourcedAggregate.js').EventSourcedAggregate;
var AggregateSnapshot = require('../utils/AggregateSnapshot.js').AggregateSnapshot;
var DummyAggregateSnapshotter = require('../EventStore/DummyAggregateSnapshotter.js').DummyAggregateSnapshotter;
var Event = require('../Event.js').Event;
var assert = require('assert');
var util = require('util');

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
			assert.equal(aggr1._nextSequenceNumber, 2);
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
	describe('#saveSnapshot', function(){
		var snapshotDB = new DummyAggregateSnapshotter();
		it('should save the snapshot to the database', function(done){
			var aggr4 = new Snappy();
			aggr4.okay(1234);
			aggr4._snapshotter = snapshotDB;
			aggr4._aggregateID = 'aggr4';
			aggr4.saveSnapshot().then(done, done);
		});
	});
});