var QueueRouter = require('../utils/QueueRouter.js').QueueRouter;
var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;

var router = new QueueRouter();

describe('QueueRouter', function(){
	describe('#addQueue', function(){
		it('should add a queue to the set of known queues', function(){
			var proc = new QueueProcessor();
			router.addQueue('q1', proc);
		});
	});
	describe('#bindQueue', function(){
		it('should bind the previously-added queue to a routing key', function(){
			router.bindQueue('q1', 'testCategory.testKey');
		});
	});
	describe('#listen', function(){
		it('should set up a listener function on a queue and execute it on a message', function(testDone){
			router.listen('q1', function(msg){
				// Note: this "ok" field is not a magical field written by the router - it is simply part of the payload.
				if(msg.ok === true){
					testDone();
				}
				else{
					testDone(new Error('Message corrupted - expected ok value true, got ' + msg.ok));
				}
			});
			router.publish('testCategory.testKey', {ok: true});
		});
	});
	describe('#bindQueue', function(){
		it('should perform another, broader binding, on the same queue', function(){
			router.bindQueue('q1', 'testCategory.*');
		});
		it('should not route the same message twice to the same queue', function(testDone){
			var processingCounter = 0;
			var messageProcessor = function(msg){
				if(++processingCounter > 2){
					testDone(new Error('Duplicate message delivered to a queue!'));
				}
			};
			// Create another queue and issue another bind, so that two queues get the message.
			router.addQueue('q2', new QueueProcessor());
			router.bindQueue('q2', 'testCategory.*');
			router.listen('q1', messageProcessor);
			router.listen('q2', messageProcessor);
			router.publish('testCategory.testKey', {});
			setTimeout(testDone, 20);
		});
	});
});