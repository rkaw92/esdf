var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var when = require('when');

describe('QueueProcessor', function(){
	var serialProcessor = new QueueProcessor(function(workItem){
		return workItem();
	}, {
		concurrencyLimit: 1
	});
	var parallelProcessor = new QueueProcessor(function(workItem){
		return workItem();
	}, {
		concurrencyLimit: 100
	});
	// Initialize a test event emitter. The emitter will emit events from within the work items. This is how we know the items are getting executed successfully.
	var testEmitter = new EventEmitter();
	describe('#push', function(){
		it('should add a function (as a work item) to the queue', function(){
			serialProcessor.push(function(){
				testEmitter.emit('push1');
			});
			assert.equal(serialProcessor._queue.length, 1);
		});
	});
	describe('#start', function(){
		it('should initiate execution of the previously-added work item', function(testDone){
			testEmitter.once('push1', function(){testDone();});
			serialProcessor.start();
		});
	});
	describe('#pause', function(){
		it('should suspend initiating event processing', function(testDone){
			// Right before starting again, we will reset failHard to false. If the work item is processed before that (i.e. before start()), it means that pausing is broken.
			var failHard = true;
			testEmitter.once('push2', function(){
				assert.equal(failHard, false, 'work item processed after adding while paused');
				testDone();
			});
			serialProcessor.pause();
			serialProcessor.push(function(){
				testEmitter.emit('push2');
			});
			serialProcessor.push(function(){});
			setImmediate(function(){
				failHard = false;
				serialProcessor.start();
			});
		});
	});
	describe('#start with parallel processing', function(){
		it('should execute 100 tasks in parallel, with each one starting before the others finish', function(testDone){
			// Take care: this test may be timing-sensitive. Do not try putting 2M tasks in the queue and seeing if they execute in "parallel"...
			var parallelCounter = 0;
			var parallelProcessedFunction = function(){
				var dummyFuture = when.defer();
				parallelCounter++;
				if(parallelCounter === 100){
					testDone();
				}
				setTimeout(function(){
					parallelCounter--;
					dummyFuture.resolver.resolve();
				}, 100);
				return dummyFuture.promise;
			};
			for(var i = 0; i < 100; ++i){
				parallelProcessor.push(parallelProcessedFunction);
			}
			parallelProcessor.start();
		});
	});
});