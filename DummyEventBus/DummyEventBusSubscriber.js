/**
 * @module esdf/test/DummyEventBusSubscriber
 */

var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var BusQueueWrapper = require('../utils/BusQueueWrapper.js').BusQueueWrapper;

/**
 * Construct a new DummyEventBusSubscriber. It is meant to be used for listening to events published via the DummyEventBusPublisher.
 * @param {module:esdf/test/DummyEventBusPublisher} dummyBusPublisher The bus to connect to.
 */
function DummyEventBusSubscriber(dummyBusPublisher){
	this._bus = dummyBusPublisher.getRouter();
}

DummyEventBusSubscriber.prototype.queue = function queue(queueName, queueOptions){
	var newQueue = new QueueProcessor();
	try{
		this._bus.addQueue(newQueue);
	}
	catch(e){
		if(e.labels && e.labels.failureType === 'DuplicateQueue'){
			
		}
		// Adding queue failed - there must be another queue under this name already.
	}
};