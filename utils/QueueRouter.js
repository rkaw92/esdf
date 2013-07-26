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
	this._addListener(routingKey, function(message){
		router._queues[queueName].push(message);
	});
};

QueueRouter.prototype.publish = function publish(routingKey, message){
	this._internalEmitter.emit(routingKey, message);
};