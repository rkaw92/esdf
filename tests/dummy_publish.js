'use strict';

const esdf = require('esdf');
const DummyEventSink = esdf.test.DummyEventSink;
const DummyEventSinkStreamer = esdf.test.DummyEventSinkStreamer;
const QueueProcessor = esdf.utils.QueueProcessor;
const QueueRouter = esdf.utils.QueueRouter;
const DummyEventBusPublisher = esdf.test.DummyEventBusPublisher;
const DummyEventBusSubscriber = esdf.test.DummyEventBusSubscriber;
const Event = esdf.core.Event;
const Commit = esdf.core.Commit;

var sink = new DummyEventSink();
var streamer = new DummyEventSinkStreamer(sink);
var publisher = new DummyEventBusPublisher();
var subscriber = new DummyEventBusSubscriber(publisher);
streamer.setPublisher(publisher);
streamer.start();

describe('DummyEventPublisher', function(){
	it('should activate an event handler subscribed to the publisher\'s queue', function(testDone){
		var q1 = subscriber.queue('q1');
		var q2 = subscriber.queue('q2');
		q1.bind('DummyAggregateType.TestEventType');
		q1.listen(function(eventCommitObject){
			testDone();
		});
		sink.sink(new Commit([
			new Event('TestEventType', {}),
			new Event('OtherIrrelevantEventType', {})
		], 'seq1', 1, 'DummyAggregateType', {meta1: 'metavalue1'}
		));
	});
});