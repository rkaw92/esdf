/**
 * @module esdf/test/DummyEventBusSubscriber
 */

var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var BusQueueWrapper = require('../utils/BusQueueWrapper.js').BusQueueWrapper;

/**
 * Construct a new DummyEventBusSubscriber. It is meant to be used for listening to events published via the DummyEventBusPublisher.
 * @param {module:esdf/Test/DummyEventBusPublisher} dummyBusPublisher The bus to connect to.
 */
function DummyEventBusSubscriber(dummyBusPublisher){
	this._bus = dummyBusPublisher.getRouter();
}

/**
 * Obtain a queue object conforming to the BusQueueWrapper contract. The object can be used to interact with the underlying event queue.
 * TODO: document this contract, perhaps by providing an interface and adding a @returns here.
 */
DummyEventBusSubscriber.prototype.queue = function queue(queueName, queueOptions){
	if(!this._bus.queueExists(queueName)){
		this._bus.addQueue(queueName, new QueueProcessor(queueOptions));
	}
	return new BusQueueWrapper(this._bus, queueName);
};

module.exports.DummyEventBusSubscriber = DummyEventBusSubscriber;