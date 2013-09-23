var DummyEventSink = require('../EventStore/DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate').EventSourcedAggregate;
var Event = require('../Event').Event;
var Commit = require('../Commit').Commit;
var loadAggregate = require('../utils/loadAggregate.js').loadAggregate;
var when = require('when');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var aggr = new EventSourcedAggregate();
aggr._pages = [];
aggr._eventSink = new DummyEventSink();
aggr._aggregateID = 'dummy1';

describe('EventSourcedAggregate', function(){
	describe('.commit() success', function(){
		it('should commit the event in a commit successfully', function(test_done){
			aggr._eventSink._wantSinkSuccess = true;
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
			aggr._eventSink._wantSinkSuccess = false;
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
			aggr._eventSink._wantSinkSuccess = false;
			aggr._eventSink._failureType = 'concurrency';
			var sinkObserver = new EventEmitter();
			var reloaded = false;
			sinkObserver.on('error', function(error){
				aggr._eventSink._wantSinkSuccess = true;
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
			ar2._aggregateID = 'dummy3';
			ar2._eventSink = new DummyEventSink();
			ar2._stageEvent(new Event('Okayed', {take: 4}));
			ar2.commit().then(function(){
				// When we have committed the AR's events, load another instance of the same entity and see if the event shows up.
				loadAggregate(OkayAggregate, 'dummy3', ar2._eventSink).then(
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
		});
	});
});