var DummyEventSink = require('../EventStore/DummyEventSink.js').DummyEventSink;
var DummyEventSinkStreamer = require('../EventStore/DummyEventSinkStreamer.js').DummyEventSinkStreamer;
var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var QueueRouter = require('../utils/QueueRouter.js').QueueRouter;
var DummyEventBusPublisher = require('../EventBus/DummyEventBusPublisher.js').DummyEventBusPublisher;
var DummyEventBusSubscriber = require('../EventBus/DummyEventBusSubscriber.js').DummyEventBusSubscriber;
var Event = require('../Event.js').Event;
var Commit = require('../Commit.js').Commit;

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
		q1.listen(function(event){
			testDone();
		});
		sink.sink(new Commit([
			new Event('TestEventType', {}),
			new Event('OtherIrrelevantEventType', {})
		], 'seq1', 1, 'DummyAggregateType', {meta1: 'metavalue1'}
		));
	});
});