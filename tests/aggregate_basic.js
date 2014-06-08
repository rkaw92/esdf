var DummyEventSink = require('../EventStore/DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate.js').EventSourcedAggregate;
var Event = require('../Event.js').Event;
var Commit = require('../Commit.js').Commit;
var loadAggregate = require('../utils/loadAggregate.js').loadAggregate;
var when = require('when');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var aggr = new EventSourcedAggregate();
aggr._pages = [];
aggr.setEventSink(new DummyEventSink());
aggr.setAggregateID('dummy1');

describe('EventSourcedAggregate', function(){
	describe('.commit() success', function(){
		it('should commit the event in a commit successfully', function(test_done){
			aggr.getEventSink()._wantSinkSuccess = true;
			aggr.onPageCreated = function(event){
				var eventPayload = event.eventPayload;
				this._pages.push({title: eventPayload.arg1, take: eventPayload.take});
			};
			aggr._stageEvent(new Event('PageCreated', {arg1: 'val1', take: 1}));
			assert.equal(aggr._pages[0].title, 'val1', 'AR event handler broken');
			when(aggr.commit(),
			function(result){
				return test_done(null); //no error
			},
			function(reason){
				return test_done(reason); //error object passed as reason
			}
			);
		});
	});
	
	describe('.commit() failure', function(){
		it('should fail to emit the event', function(test_done){
			aggr.getEventSink()._wantSinkSuccess = false;
			aggr._stageEvent(new Event('PageCreated', {arg1: 'val1', take: 2}));
			when(aggr.commit(),
			function(result){
				return test_done(new Error('pageCreated event commit should fail, but it worked somehow!'));
			},
			function(reason){
				return test_done(null);
			}
			);
		});
	});
	
	describe('.retry test', function(){
		it('should commit the event successfully, despite a retry in the middle', function(test_done){
			aggr.getEventSink()._wantSinkSuccess = false;
			aggr.getEventSink()._failureType = 'concurrency';
			var sinkObserver = new EventEmitter();
			var reloaded = false;
			sinkObserver.on('error', function(error){
				aggr.getEventSink()._wantSinkSuccess = true;
				reloaded = true; //in lieu of a real reload
				aggr.commit().then(function(){
					test_done();
				}, function(err){
					test_done(err);
				});
			});
			aggr._stageEvent(new Event('PageCreated', {arg1: 'val2', take: 3}));
			aggr.commit().then(undefined, function(){sinkObserver.emit('error');});
		});
	});
	
	describe('.rehydrate', function(){
		it('should save and rehydrate the aggregate root', function(test_done){
			
			function OkayAggregate(){
				this.ok = false;
				this.onOkayed = function(event, commitMetadata){
					this.ok = true;
				};
				this._aggregateType = undefined;
			}
			OkayAggregate.prototype = new EventSourcedAggregate();
			
			var ar2 = new OkayAggregate();
			ar2.setAggregateID('dummy3');
			ar2.setEventSink(new DummyEventSink());
			ar2._stageEvent(new Event('Okayed', {take: 4}));
			ar2.commit().then(function(){
				// When we have committed the AR's events, load another instance of the same entity and see if the event shows up.
				loadAggregate(OkayAggregate, 'dummy3', ar2.getEventSink()).then(
				function _aggregateLoaded(ar3){
					test_done(ar3.ok ? null : new Error('Expected ar3.ok to be true, but instead got: ' + ar3.ok));
				},
				test_done);
			},
			function(reason){
				// In case of error, we pass the rejection reason right to the test framework.
				test_done(new Error(reason));
			});
		});
	});
	describe('.applyCommmit', function(){
		it('should apply a commit to the aggregate root', function(){
			function PickyAggregate(){
				this._aggregateType = 'PickyAggregate';
				this.ok = false;
			}
			PickyAggregate.prototype.onPickySampleEvent = function(){
				this.ok = true;
			};
			util.inherits(PickyAggregate, EventSourcedAggregate);
			var picky = new PickyAggregate();
			picky.applyCommit(new Commit([], 'picky', 1, 'PickyAggregate'));
			//TODO: Finish this test case. Use assert.
		});
		//TODO: corner cases (aggregateType mismatch etc.)
		it('should properly constrain visibility of commit events within event handlers', function(){
			function CommitDependentAggregate(){
				this._aggregateType = 'CommitDependentAggregate';
				this.ok = false;
			}
			util.inherits(CommitDependentAggregate, EventSourcedAggregate);
			// Note: this test case tests whether onPresentEvent sees PastEvent and does not see FutureEvent.
			CommitDependentAggregate.prototype.work = function work(){
				this._stageEvent(new Event('PastEvent', {}));
				this._stageEvent(new Event('PresentEvent', {}));
				this._stageEvent(new Event('FutureEvent', {}));
			};
			CommitDependentAggregate.prototype.onPastEvent = function(){};
			CommitDependentAggregate.prototype.onPresentEvent = function onPresentEvent(event, commit){
				var hasPastEvent = (commit.getEvents().some(function(inspectedEvent){
					return (inspectedEvent.eventType === 'PastEvent');
				}));
				var hasFutureEvent = (commit.getEvents().some(function(suspectedEvent){
					return (suspectedEvent.eventType === 'FutureEvent');
				}));
				// Only OK if we've seen PastEvent, but not FutureEvent.
				if(hasPastEvent && !hasFutureEvent){
					this.ok = true;
				}
			};
			CommitDependentAggregate.prototype.onFutureEvent = function(){};
			
			// Test 1: First run (non-rehydration).
			var dependent = new CommitDependentAggregate();
			dependent.setCurrentCommit(new Commit([], 'DEPENDENT-1', 1, 'CommitDependentAggregate', {}));
			dependent.work();
			assert(dependent.ok);
			
			// Test 2: During rehydration (applyCommit supposedly called by an EventSink).
			dependent = new CommitDependentAggregate();
			var currentCommit = new Commit([], 'DEPENDENT-1', 2, 'CommitDependentAggregate', {});
			dependent.setCurrentCommit(currentCommit); // This is extraneous, just seeing if it doesn't break anything by interfering with commit application.
			dependent.applyCommit(new Commit([
				new Event('PastEvent', {}),
				new Event('PresentEvent', {}),
				new Event('FutureEvent', {})
			], 'DEPENDENT-1', 1, 'CommitDependentAggregate', {}));
			assert(dependent.ok);
		});
	});
});