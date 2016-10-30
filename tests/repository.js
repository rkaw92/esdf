'use strict';

const esdf = require('esdf');
const TestEnvironment = require('../').utils.TestEnvironment;
const EventSourcedAggregate = esdf.core.EventSourcedAggregate;
const Event = esdf.core.Event;
const when = require('when');
const assert = require('assert');

var env = new TestEnvironment();

function DummyAggregate(){
	this.ok = false;
}
DummyAggregate.prototype = new EventSourcedAggregate();
DummyAggregate.prototype._aggregateType = 'DummyAggregate';
DummyAggregate.prototype.onOkayed = function(){
	this.ok = true;
};
DummyAggregate.prototype.makeEverythingOkay = function(grade) {
	this._stageEvent(new Event('Okayed', {
		grade: grade || 0
	}));
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
					aggregateObject.makeEverythingOkay(3);
					assert(aggregateObject.ok);
				}, { advanced: true, diffSince: 0 });
			}).then(function(result) {
				// Ensure we are only getting the diff from before the operation - it must not include the newly-persisted commit.
				assert.equal(result.rehydration.diffCommits.length, 1);
				assert.equal(result.rehydration.diffCommits[0].events[0].eventType, 'Okayed');
			});
		});
		it('should return the commits that took place since a designated point in time plus the new commit if requested', function() {
			// First, put exactly one commit in this aggregate root's stream.
			return env.repository.invoke(DummyAggregate, 'dummy-3', function(aggregateObject){
				// It's a solid 5/7 grade.
				aggregateObject.makeEverythingOkay(5);
				assert(aggregateObject.ok);
			}).then(function() {
				// Then, perform another transaction on the aggregate root, but this time, request a diff since the beginning, too.
				return env.repository.invoke(DummyAggregate, 'dummy-3', function(aggregateObject){
					aggregateObject.makeEverythingOkay(7);
					assert(aggregateObject.ok);
				}, { advanced: true, diffSince: 0, newCommits: true });
			}).then(function(result) {
				// Assert that all commits are in the returned value:
				assert.equal(result.rehydration.diffCommits.length, 2);
				assert.equal(result.rehydration.diffCommits[0].events[0].eventType, 'Okayed');
				assert.equal(result.rehydration.diffCommits[0].events[0].eventPayload.grade, 5);
				assert.equal(result.rehydration.diffCommits[1].events[0].eventType, 'Okayed');
				assert.equal(result.rehydration.diffCommits[1].events[0].eventPayload.grade, 7);
				
			});
		});
	});
});