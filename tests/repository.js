var TestEnvironment = require('../utils/TestEnvironment').TestEnvironment;
var EventSourcedAggregate = require('../EventSourcedAggregate').EventSourcedAggregate;
var Event = require('../Event').Event;
var when = require('when');
var assert = require('assert');

var env = new TestEnvironment();

function DummyAggregate(){
	this.ok = false;
}
DummyAggregate.prototype = new EventSourcedAggregate();
DummyAggregate.prototype._aggregateType = 'DummyAggregate';
DummyAggregate.prototype.onOkayed = function(){
	this.ok = true;
};
DummyAggregate.prototype.makeEverythingOkay = function(){
	this._stageEvent(new Event('Okayed', {}));
};

describe('Repository', function(){
	describe('#invoke', function(){
		it('should execute the user-provided function against the aggregate', function(done) {
			// When we get the event that we were expecting in a stream from the Event Store, we are done with this test.
			env.receiver.once('Okayed', function() {
				done();
			});
			
			env.repository.invoke(DummyAggregate, 'dummy-1', function(aggregateObject){
				aggregateObject.makeEverythingOkay();
				assert(aggregateObject.ok);
			}).otherwise(console.log);
		});
		it('should return the commits that took place since a designated point in time (in advanced mode)', function() {
			// First, put exactly one commit in this aggregate root's stream.
			return env.repository.invoke(DummyAggregate, 'dummy-2', function(aggregateObject){
				aggregateObject.makeEverythingOkay();
				assert(aggregateObject.ok);
			}).then(function() {
				// Then, perform another transaction on the aggregate root, but this time, request a diff since the beginning, too.
				return env.repository.invoke(DummyAggregate, 'dummy-2', function(aggregateObject){
					aggregateObject.makeEverythingOkay();
					assert(aggregateObject.ok);
				}, { advanced: true, diffSince: 0 });
			}).then(function(result) {
				// Ensure we are only getting the diff from before the operation - it must not include the newly-persisted event.
				assert.equal(result.rehydration.diffCommits.length, 1);
				assert.equal(result.rehydration.diffCommits[0].events[0].eventType, 'Okayed');
			});
		});
	});
});