var DummyEventSink = require('../DummyEventSink.js');
var EventSourcedAggregate = require('../EventSourcedAggregate');
var when = require('when');
var assert = require('assert');

var aggr = new EventSourcedAggregate();
aggr._eventSink = new DummyEventSink();

describe('EventSourcedAggregate', function(){
	describe('#emit() successful', function(){
		it('should emit the event successfully', function(test_done){
			aggr._eventSink._want_success = true;
			when(aggr.emit('pageCreated', {arg1: 'val1', timestamp: new Date()}),
			function(result){
				return test_done(null); //no error
			},
			function(reason){
				return test_done(reason); //error object passed as reason
			}
			);
		});
	});
	
	describe('#emit() failure', function(){
		it('should fail to emit the event', function(test_done){
			aggr._eventSink._want_success = false;
			when(aggr.emit('pageCreated', {arg1: 'val1', timestamp: new Date()}),
			function(result){
				return test_done(new Error('pageCreated event emit should fail, but it worked somehow!'));
			},
			function(reason){
				return test_done(null);
			}
			);
		});
	});
	
	describe('#run() retry test', function(){
		it('should emit the event successfully, despite a retry in the middle', function(test_done){
			aggr._eventSink._want_success = false;
			aggr._eventSink._failure_type = 'concurrency';
			var reloaded = false;
			aggr.on('_error', function(error){
				aggr._eventSink._want_success = true;
				reloaded = true;
				aggr._emitActual('_reloaded');
			});
			when(aggr.run(aggr.emit, ['pageCreated', {arg1: 'val1', timestamp: new Date()}]),
			function(result){
				test_done(reloaded ? null : new Error('No reload occured during the test, reloaded = ' + reloaded)); //probably after a re-emission
			},
			function(reason){
				test_done(new Error('Retry failed'));
			}
			);
		});
	});
});