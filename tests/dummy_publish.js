var DummyEventSink = require('../DummyEventStore/DummyEventSink.js').DummyEventSink;
var DummyEventSinkStreamer = require('../DummyEventStore/DummyEventSinkStreamer.js').DummyEventSinkStreamer;
var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var QueueRouter = require('../utils/QueueRouter.js').QueueRouter;
var DummyEventBusPublisher = require('../DummyEventBus/DummyEventBusPublisher.js').DummyEventBusPublisher;
var Event = require('../Event.js').Event;
var Commit = require('../Commit.js').Commit;

var sink = new DummyEventSink();
var streamer = new DummyEventSinkStreamer(sink);
var router = new QueueRouter();
var publisher = new DummyEventBusPublisher(router);
streamer.setPublisher(publisher);
streamer.start();

describe('DummyEventPublisher', function(){
	it('should activate an event handler subscribed to the publisher\'s queue', function(testDone){
		var q1 = new QueueProcessor();
		var q2 = new QueueProcessor();
		router.addQueue('q1', q1);
		router.bindQueue('q1', 'TestEventType');
		router.listen('q1', function(event){
			testDone();
		});
		sink.sink(new Commit([
			new Event('TestEventType', {}),
			new Event('OtherIrrelevantEventType', {})
		], 'seq1', 1, {meta1: 'metavalue1'}
		));
	});
});