var esdf = require('esdf');
var when = require('when');

function SagaQueueSubscriber(sagaConstructor, subscriberObject, options){
	if(!(sagaConstructor instanceof Saga){
		throw new Error('SagaQueueSubscriber requires a constructor derived from Saga');
	}
	if(options.queueName){
		this._queueName = options.queueName;
	}
	else if(sagaConstructor.prototype._aggregateType){
		if(sagaConstructor.prototype._aggregateType !== 'Saga'){
			// Since we lack a better name, we set the queue name to the saga's name.
			this._queueName = sagaConstructor.prototype._aggregateType;
		}
		else{
			// Apparently, somebody forgot to override _aggregateType.
			throw new Error('The passed saga constructor does not override _aggregateType and no options.queueName has been provided. Bailing out!');
		}
	}
	else{
		throw new Error('No means provided for the queue subscriber to determine queue name - provide options.queueName or assign an _aggregateType to the saga!');
	}
}

SagaQueueSubscriber.prototype.start = function start(){
	return when(subscriberObject.queue(queueName, options.queueOptions || {}),
	function _queueObtained(queueObject){
		var sagaBinds = sagaConstructor.getBinds();
		var bindPromises = [];
		sagaBinds.forEach(function(desiredBinding){
			bindPromises.push(queueObject.bind(desiredBinding));
		});
		return when.all(bindPromises);
	},
	function _queueObtainmentFailed(reason){
		
	});
};