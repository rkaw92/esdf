var DummyEventSink = require('../DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate').EventSourcedAggregate;
var Event = require('../Event').Event;
var when = require('when');
var assert = require('assert');

var aggr = new EventSourcedAggregate();
aggr._pages = [];
aggr._eventSink = new DummyEventSink();
aggr._aggregateID = 'dummy1';

describe('EventSourcedAggregate', function(){
	describe('#commit() success', function(){
		it('should commit the event successfully, with a command ID attached', function(test_done){
			aggr._eventSink._wantSinkSuccess = true;
			aggr.on('PageCreated', function(eventPayload){this._pages.push({title: eventPayload.arg1, take: eventPayload.take});});
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
	
	describe('#commit() failure', function(){
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
	
	describe('#retry test', function(){
		it('should commit the event successfully, despite a retry in the middle', function(test_done){
			aggr._eventSink._wantSinkSuccess = false;
			aggr._eventSink._failureType = 'concurrency';
			var reloaded = false;
			aggr.on('error', function(error){
				aggr._eventSink._wantSinkSuccess = true;
				reloaded = true; //in lieu of a real reload
				aggr.commit().then(function(){
					test_done();
				}, function(err){
					test_done(err);
				});
			});
			aggr._stageEvent(new Event('PageCreated', {arg1: 'val2', take: 3}));
			aggr.commit().then(undefined, function(){aggr.emit('error');});
		});
	});
	
	describe('#rehydrate', function(){
		it('should save and rehydrate the aggregate root', function(test_done){
			var ar2 = new EventSourcedAggregate();
			ar2._aggregateID = 'dummy3';
			ar2._eventSink = new DummyEventSink();
			ar2._stageEvent(new Event('okayed', {take: 4}));
			ar2.commit().then(function(){
				// When we have committed the AR's events, load another instance of the same entity and see if the event shows up.
				var ar3 = new EventSourcedAggregate();
				ar3._aggregateID = ar2._aggregateID;
				ar3._eventSink = ar2._eventSink;
				ar3.on('okayed', function(){
					// This is an ok flag. If the event handler is not called for some reason, it will not be set, so we'll know the event sink did not reliably rehydrate us.
					this.ok = true;
				});
				var rehydration_promise = ar3._eventSink.rehydrate(ar3, ar3._aggregateID);
				rehydration_promise.then(function(){
					test_done(ar3.ok ? null : new Error('Expected ar3.ok to be true, but instead got: ' + ar3.ok));
				}, test_done, function(ev){console.log('Notify:', ev);});
			},
			function(reason){
				// In case of error, we pass the rejection reason right to the test framework.
				test_done(new Error(reason));
			});
		});
	});
	
// 	describe('#command deduplication', function(){
// 		it('should return undefined from the method wrapper call, rather than generate an exception', function(){
// 			aggr.dummyCommand = EventSourcedAggregate.deduplicateCommand(function(){throw new Error('Should not be called!');});
// 			return ((aggr.dummyCommand('command-1', 'a', 'b', 'c') === undefined && aggr._executedCommands['command-1']) ? null : new Error('Command has not been deduplicated!'));
// 		});
// 	});
});