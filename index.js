//TODO: complete refactoring of exports
module.exports.core = {};
module.exports.core.EventSourcedAggregate = require('./EventSourcedAggregate.js').EventSourcedAggregate;
module.exports.core.Event = require('./Event.js').Event;
module.exports.core.Commit = require('./Commit.js').Commit;
module.exports.utils = require('./utils');
module.exports.test = {};
module.exports.test.DummyEventSink = require('./EventStore/DummyEventSink.js').DummyEventSink;
module.exports.test.DummyEventSinkStreamer = require('./EventStore/DummyEventSinkStreamer.js').DummyEventSinkStreamer;
module.exports.test.DummyEventBusPublisher = require('./EventBus/DummyEventBusPublisher.js').DummyEventBusPublisher;
module.exports.test.DummyEventBusSubscriber = require('./EventBus/DummyEventBusSubscriber.js').DummyEventBusSubscriber;
module.exports.test.DummyAggregateSnapshotter = require('./EventStore/DummyAggregateSnapshotter.js').DummyAggregateSnapshotter;