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
var repository = new esdf.components.Repository({ sink });

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
