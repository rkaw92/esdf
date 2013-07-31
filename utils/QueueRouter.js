/**
 * @module esdf/utils/QueueRouter
 */
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * Construct a new QueueRouter. A QueueRouter accepts annotated messages and distributes them to queues in a publish-subscribe fashion.
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

/**
 * 
 */
QueueRouter.prototype._addListener = function _addListener(routingSpecification, listenerFunction){
	this._internalEmitter.on(routingSpecification, listenerFunction);
};

QueueRouter.prototype.addQueue = function addQueue(queueName, queueProcessorObject){
	if(!this._queues[queueName]){
		this._queues[queueName] = queueProcessorObject;
	}
	else{
		throw new Error('A queue already exists under this name - can not re-add!');
	}
};

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

QueueRouter.prototype.listen = function listen(queueName, listenerFunction){
	if(!this._queues[queueName]){
		throw new Error('Can not listen on a non-existent queue');
	}
	this._queues[queueName].setProcessorFunction(listenerFunction);
	this._queues[queueName].start();
};

QueueRouter.prototype.publish = function publish(routingKey, message){
	// Define a set of queue names which already contain this message. Event handlers are supposed to check this set before adding messages to queues, so as to avoid pushing duplicates.
	var visitedQueues = {};
	// Note: we pass the visited queues object by reference and that is intentional. Each event handler will check and enrich this set.
	this._internalEmitter.emit(routingKey, message, visitedQueues);
};

module.exports.QueueRouter = QueueRouter;