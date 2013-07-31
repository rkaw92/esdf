var DummyEventSink = require('../DummyEventSink.js').DummyEventSink;
var DummyEventSinkStreamer = require('../DummyEventSinkStreamer.js').DummyEventSinkStreamer;
var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var QueueRouter = require('../utils/QueueRouter.js').QueueRouter;
var DummyEventPublisher = require('../DummyEventPublisher.js').DummyEventPublisher;
var Event = require('../Event.js').Event;
var Commit = require('../Commit.js').Commit;

var sink = new DummyEventSink();
var streamer = new DummyEventSinkStreamer(sink);
var router = new QueueRouter();
var publisher = new DummyEventPublisher(router);
streamer.setPublisher(publisher);

describe('DummyEventPublisher', function(){
	it('should activate an event handler subscribed to the publisher\'s queue', function(testDone){
		var q1 = new QueueProcessor();
		var q2 = new QueueProcessor();
		router.addQueue('q1', q1);
		router.addQueue('q2', q2);
		router.bindQueue('q2', '*');
		router.listen('q2', function(){
			console.log(arguments);
		});
		router.bindQueue('q1', 'TestEventType');
		router.listen('q1', function(event){
			testDone();
		});
		publisher.publishCommit(new Commit([
			new Event('TestEventType', {}),
			new Event('OtherIrrelevantEventType', {})
		], 'seq1', 1, {meta1: 'metavalue1'}
		));
	});
});