/**
 * @module esdf/utils/BusQueueWrapper
 */

function BusQueueWrapper(queueRouter, queueName){
	this._bus = queueRouter;
	this._queueName = queueName;
}

BusQueueWrapper.prototype.bind = function bind(routingKey){
	this._bus.bindQueue(this._queueName, routingKey);
	return this;
};

BusQueueWrapper.prototype.listen = function listen(processorFunction){
	this._bus.listen(this._queueName, processorFunction);
	return this;
};

BusQueueWrapper.prototype.pause = function pause(){
	this._bus.pause(this._queueName);
	return this;
};

BusQueueWrapper.prototype.resume = function resume(){
	this._bus.resume(this._queueName);
	return this;
};

module.exports.BusQueueWrapper = BusQueueWrapper;