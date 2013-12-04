module.exports.core = {
	EventSourcedAggregate: require('./EventSourcedAggregate.js').EventSourcedAggregate,
	Event: require('./Event.js').Event,
	Commit: require('./Commit.js').Commit
};

module.exports.utils = require('./utils');

module.exports.test = {
	DummyEventSink: require('./EventStore/DummyEventSink.js').DummyEventSink,
	DummyEventSinkStreamer: require('./EventStore/DummyEventSinkStreamer.js').DummyEventSinkStreamer,
	DummyEventBusPublisher: require('./EventBus/DummyEventBusPublisher.js').DummyEventBusPublisher,
	DummyEventBusSubscriber: require('./EventBus/DummyEventBusSubscriber.js').DummyEventBusSubscriber,
	DummyAggregateSnapshotter: require('./EventStore/DummyAggregateSnapshotter.js').DummyAggregateSnapshotter
};

module.exports.services = {
	ServiceContainer: require('./Services/ServiceContainer.js').ServiceContainer
};