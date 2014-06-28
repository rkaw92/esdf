var Repository = require('../utils/Repository.js').Repository;
var DummyEventSink = require('../EventStore/DummyEventSink.js').DummyEventSink;
var DummyEventSinkStreamer = require('../EventStore/DummyEventSinkStreamer.js').DummyEventSinkStreamer;
var EventSourcedAggregate = require('../EventSourcedAggregate.js').EventSourcedAggregate;
var AggregateLoader = require('../utils/loadAggregate.js');
var Event = require('../Event').Event;
var when = require('when');
var assert = require('assert');

var sink = new DummyEventSink();
var loader = AggregateLoader.createAggregateLoader(sink, undefined);
var repository = new Repository(loader, sink.sink.bind(sink));

function DummyAggregate(){
	this.ok = false;
}
DummyAggregate.prototype = new EventSourcedAggregate();
DummyAggregate.prototype._aggregateType = 'DummyAggregate';
DummyAggregate.prototype.onOkayed = function(){
	this.ok = true;
};
DummyAggregate.prototype.makeEverythingOkay = function(){
	this._stageEvent(new Event('Okayed', {}));
};

describe('Repository', function(){
	describe('#invoke', function(){
		it('should execute the user-provided function against the aggregate', function(done){
			var streamer = new DummyEventSinkStreamer(sink);
			streamer.setPublisher({
				publishCommit: function(commit){
					if(commit.events[0].eventType === 'Okayed'){
						done();
					}
				}
			});
			streamer.start();
			repository.invoke(DummyAggregate, 'dummy-1', function(aggregateObject){
				aggregateObject.makeEverythingOkay();
				assert(aggregateObject.ok);
			}).otherwise(console.log);
		});
	});
});