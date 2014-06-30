/**
 * @module esdf/utils/QueueRouter
 */
var EventEmitter2 = require('eventemitter2').EventEmitter2;
//TODO: Complete refactoring to support message processing notification (promises?). The router should be able to track which messages have been handled by all listeners.

/**
 * Construct a new QueueRouter. A QueueRouter accepts annotated messages and distributes them to queues in a publish-subscribe fashion.
 * @constructor
 */
function QueueRouter(){
	/**
	 * EventEmitter2, used for wildcard-based routing internally.
	 */
	this._internalEmitter = new EventEmitter2({
		wildcard: true
	});
	/**
	 * Holds a map of queue names => queue processor objects. Queues are added by consumers under their chosen names.
	 */
	this._queues = {};
}
//TODO: documentation!
/**
 * Add an event handler on a particular routing key/wildcard. Used only by internal routing functions to deliver messages to queues.
 * @param {string} routingSpecification The routing key, as used by EventEmitter2.
 * @param {function} listenerFunction The event handler, used to dispatch messages to queues. Normally a closure with the router's queues in scope.
 */
QueueRouter.prototype._addListener = function _addListener(routingSpecification, listenerFunction){
	this._internalEmitter.on(routingSpecification, listenerFunction);
};

/*
 * Create a new processing queue with the given name.
 * @param {string} queueName Queue name, to be used as a handle later when setting up listeners.
 * @param {module:esdf/utils/QueueProcessor.QueueProcessor} queueProcessorObject The queue to (possibly) route to.
 */
QueueRouter.prototype.addQueue = function addQueue(queueName, queueProcessorObject){
	if(!this._queues[queueName]){
		this._queues[queueName] = queueProcessorObject;
	}
	else{
		throw new Error('A queue already exists under name "' + queueName + '" - can not re-add!');
	}
};

/**
 * Check if a queue with the given name exists.
 * @param {string} queueName Name of the queue to check.
 * @returns {boolean} Whether the queue exists.
 */
QueueRouter.prototype.queueExists = function queueExists(queueName){
	return (typeof(this._queues[queueName]) === 'object');
};

/**
 * Add a route to a queue, so that messages with a particular key are routed to it.
 * @param {string} queueName The queue name to add the route to.
 * @param {string} routingKey The key to match against. May include wildcards, as per EventEmitter2's syntax.
 */
QueueRouter.prototype.bindQueue = function bindQueue(queueName, routingKey){
	var router = this;
	this._addListener(routingKey, function(message, visitedQueues){
		// Check if another handler has already added this message to the queue. If yes, do nothing.
		if(!visitedQueues[queueName]){
			router._queues[queueName].push(message);
			// Register the queue as visited in this message context.
			visitedQueues[queueName] = true;
		}
	});
};

//TODO: Consider adding multiple listener support for feature parity with AMQP.
/**
 * Set up a listener function to consume messages from a queue.
 * Also unpauses the queue immediately, so that messages start being delivered to the function.
 * @param {string} queueName Name of the queue to listen on.
 * @param {function} listenerFunction The consumer function that messages will be passed to. Must accept 1 parameter (the message, whatever type it is) and should return a promise.
 */
QueueRouter.prototype.listen = function listen(queueName, listenerFunction){
	if(!this._queues[queueName]){
		throw new Error('Can not listen on a non-existent queue "' + queueName + '"!');
	}
	this._queues[queueName].setProcessorFunction(listenerFunction);
	this._queues[queueName].start();
};

/**
 * Pause the given queue (by name). The consumer function will not be called any more (though "running" asynchronous instances are not aborted).
 * @param {string} queueName Which queue to pause.
 */
QueueRouter.prototype.pause = function pause(queueName){
	this._queues[queueName].pause();
};


/**
 * Resume calling the consumer function (and consuming messages) for a given queue.
 * @param {string} queueName Name of the queue to resume consumption on.
 */
QueueRouter.prototype.resume = function resume(queueName){
	this._queues[queueName].start();
};

/**
 * Publish a message to all queues which are bound to the routing key of the message.
 * If a queue is bound to several matching patterns, the message is still only delivered once to each queue.
 * @param {string} routingKey The key to be matched against queues' set routing patterns.
 * @param message The payload to deliver to every matched queue.
 */
QueueRouter.prototype.publish = function publish(routingKey, message){
	// Define a set of queue names which already contain this message. Event handlers are supposed to check this set before adding messages to queues, so as to avoid pushing duplicates.
	var visitedQueues = {};
	// Note: we pass the visited queues object by reference and that is intentional. Each event handler will check and enrich this set.
	this._internalEmitter.emit(routingKey, message, visitedQueues);
};

module.exports.QueueRouter = QueueRouter;