var Repository = require('../utils/Repository.js').Repository;
var DummyEventSink = require('../EventStore/DummyEventSink.js').DummyEventSink;
var DummyEventSinkStreamer = require('../EventStore/DummyEventSinkStreamer.js').DummyEventSinkStreamer;
var AggregateLoader = require('../utils/loadAggregate.js');
var EventEmitter = require('events').EventEmitter;

function TestEnvironment() {
	var self = this;
	
	self.sink = new DummyEventSink();
	self.loader = AggregateLoader.createAggregateLoader(self.sink, undefined);
	self.repository = new Repository(self.loader);
	self.streamer = new DummyEventSinkStreamer(self.sink);
	self.receiver = new EventEmitter();
	
	self.streamer.setPublisher({
		publishCommit: function publishCommit(commit) {
			// Publish each Domain Event as a separate event from the emitter.
			commit.events.forEach(function(event) {
				self.receiver.emit(event.eventType, event, commit);
			});
		}
	});
	
	self.streamer.start();
}

module.exports.TestEnvironment = TestEnvironment;
