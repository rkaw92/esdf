var esdf = require('../index');
var util = require('util');
var assert = require('assert');
var when = require('when');

function SomeAggregate(){
	this._okayed = false;
}
util.inherits(SomeAggregate, esdf.core.EventSourcedAggregate);
SomeAggregate.prototype._aggregateType = 'SomeAggregate';

SomeAggregate.prototype.onOkayed = function onOkayed(event){
	this._okayed = true;
};

SomeAggregate.prototype.okay = function okay(){
	this._stageEvent(new esdf.core.Event('Okayed', {}));
};

function CounterAggregate(){
	this._counter = 0;
}
util.inherits(CounterAggregate, esdf.core.EventSourcedAggregate);

CounterAggregate.prototype.incrementAndReturn = function incrementAndReturn() {
	this._stageEvent(new esdf.core.Event('Incremented', {}));
	return this._counter;
};

CounterAggregate.prototype.onIncremented = function onIncremented() {
	this._counter = this._counter + 1;
};

var sink = new esdf.test.DummyEventSink();
var loader = esdf.utils.createAggregateLoader(sink);
var tryWith = esdf.utils.tryWith;
var repository = new esdf.utils.Repository(loader);

describe('tryWith', function(){
	it('should pass the value returned by the user function to the promise resolution', function(done){
		tryWith(loader, SomeAggregate, 'TestAggregate-1', function testUserFunction(testAggregate){
			testAggregate.okay();
			return 42;
		}).done(function(okayResolution){
			assert.strictEqual(okayResolution, 42);
			done();
		});
	});

	it('should return the latest method return value on reload/retry', function(done) {
		var counter1 = null;
		var counter2 = null;
		when.all([
			tryWith(loader, CounterAggregate, 'TestAggregate-3', function testUserFunction(counter){
				return counter.incrementAndReturn();
			}).then(function(counterValue){
				counter1 = counterValue;
			}),
			tryWith(loader, CounterAggregate, 'TestAggregate-3', function testUserFunction(counter){
				return counter.incrementAndReturn();
			}).then(function(counterValue){
				counter2 = counterValue;
			})
		]).then(function() {
			assert((typeof counter1) === 'number');
			assert((typeof counter2) === 'number');
			assert.notStrictEqual(counter1, counter2);
			done();
		}).catch(done);
	});

	it('should return the latest method return value on reload/retry also in advanced mode', function(done) {
		var counter1 = null;
		var counter2 = null;
		when.all([
			tryWith(loader, CounterAggregate, 'TestAggregate-4', function testUserFunction(counter){
				return counter.incrementAndReturn();
			}, { advanced: true }).then(function(output){
				counter1 = output.result;
			}),
			tryWith(loader, CounterAggregate, 'TestAggregate-4', function testUserFunction(counter){
				return counter.incrementAndReturn();
			}, { advanced: true }).then(function(output){
				counter2 = output.result;
			})
		]).then(function() {
			assert((typeof counter1) === 'number');
			assert((typeof counter2) === 'number');
			assert.notStrictEqual(counter1, counter2);
			done();
		}).catch(done);
	});
});

describe('Repository', function(){
	describe('#invoke', function(){
		it('should pass the value the same way that tryWith does', function(done){
			repository.invoke(SomeAggregate, 'TestAggregate-2', function testUserFunction(testAggregate){
				return 42;
			}).done(function(okayResolution){
				assert.strictEqual(okayResolution, 42);
				done();
			});
		});
	});
});
