var esdf = require('../index');
var util = require('util');
var assert = require('assert');

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

var sink = new esdf.test.DummyEventSink();
var loader = esdf.utils.createAggregateLoader(sink);
var saver = sink.sink.bind(sink);
var tryWith = esdf.utils.tryWith;
var repository = new esdf.utils.Repository(loader, sink.sink.bind(sink));

describe('tryWith', function(){
	it('should pass the value returned by the user function to the promise resolution', function(done){
		tryWith(loader, saver, SomeAggregate, 'TestAggregate-1', function testUserFunction(testAggregate){
			testAggregate.okay();
			return 42;
		}).done(function(okayResolution){
			assert.strictEqual(okayResolution, 42);
			done();
		});
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