var DummyEventSink = require('../DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate').EventSourcedAggregate;
var when = require('when');
var assert = require('assert');

var aggr = new EventSourcedAggregate();
aggr.assignEventSink(new DummyEventSink());
aggr.aggregateID = 'dummy1';
aggr.on('error', function(){});

describe('EventSourcedAggregate', function(){
	describe('#commit() success', function(){
		it('should commit the event successfully, with a command ID attached', function(test_done){
			aggr.eventSink._wantSinkSuccess = true;
			aggr.stage('pageCreated', {arg1: 'val1', timestamp: new Date()});
			when(aggr.commit('command-1'),
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
			aggr.eventSink._wantSinkSuccess = false;
			aggr.stage('pageCreated', {arg1: 'val1', timestamp: new Date()});
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
			aggr.eventSink._wantSinkSuccess = false;
			aggr.eventSink._failureType = 'concurrency';
			var reloaded = false;
			aggr.on('error', function(error){
				aggr.eventSink._wantSinkSuccess = true;
				reloaded = true; //in lieu of a real reload
				aggr.commit().then(function(){
					test_done();
				}, function(err){
					test_done(err);
				});
			});
			aggr.stage('pageCreated', {arg1: 'val2', timestamp: new Date()});
			aggr.commit().then(undefined, function(){aggr.emit('error');});
		});
	});
	
	describe('#rehydrate', function(){
		it('should produce an AR that is completely equivalent to the first AR', function(test_done){
			var ar2 = new EventSourcedAggregate();
			ar2.aggregateID = 'dummy1'; //same identity
			ar2.eventSink = aggr.eventSink;
			var rehydration_promise = ar2.eventSink.rehydrate(ar2, ar2.aggregateID);
			rehydration_promise.then(function(){test_done();}, test_done);
		});
	});
	
	describe('#command deduplication', function(){
		it('should return undefined from the method wrapper call, rather than generate an exception', function(){
			aggr.dummyCommand = EventSourcedAggregate.deduplicateCommand(function(){throw new Error('Should not be called!');});
			return ((aggr.dummyCommand('command-1', 'a', 'b', 'c') === undefined && aggr._executedCommands['command-1']) ? null : new Error('Command has not been deduplicated!'));
		});
	});
});