var saga = require('./Saga.v2.js');
var logicSaga = require('./LogicSaga.js');

module.exports.core = {
	EventSourcedAggregate: require('./EventSourcedAggregate.js').EventSourcedAggregate,
	Event: require('./Event.js').Event,
	Commit: require('./Commit.js').Commit,
	Saga: saga.Saga,
	SagaStage: saga.SagaStage,
	SagaTransition: saga.SagaTransition,
	LogicSaga: logicSaga.LogicSaga,
	Timer: require('./Timer.js').Timer
};

module.exports.utils = require('./utils');
module.exports.utils.CommitStream = require('./types/CommitStream').CommitStream;

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
