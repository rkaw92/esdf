var Repository = require('../components/Repository.js');
var DummyEventSink = require('../test/DummyEventSink.js');
var DummyEventSinkStreamer = require('../test/DummyEventSinkStreamer.js');
var EventEmitter = require('events').EventEmitter;

function TestEnvironment() {
	var self = this;
	
	self.sink = new DummyEventSink();
	self.repository = new Repository({ sink: self.sink });
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

module.exports = TestEnvironment;
