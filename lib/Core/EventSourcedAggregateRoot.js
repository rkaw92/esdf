var Event = require('./Event').Event;

function EventSourcedAggregateRoot(){
	this._aggregateID = null;
	this._newEvents = [];
	this._sealed = false;
	this.eventHandlers = {};
}

// Methods from IAggregateRoot

EventSourcedAggregateRoot.prototype.getAggregateID = function getAggregateID(){
	return this._aggregateID;
};

EventSourcedAggregateRoot.prototype.setAggregateID = function setAggregateID(ID){
	this._aggregateID = ID;
	return this;
};

// Methods from IEventProducer

EventSourcedAggregateRoot.prototype.getNewEvents = function getNewEvents(){
	return (this._newEvents || []).slice();
};

EventSourcedAggregateRoot.prototype.clearEvents = function clearEvents(until){
	var newEvents = (this._newEvents || []);
	var endIndex = newEvents.indexOf(until);
	if(endIndex < 0){
		throw new Error('Clearing boundary not found when trying to clear EventSourcedAggregateRoot\'s events - invalid event passed?');
	}
	this._newEvents = newEvents.slice(newEvents.indexOf(until) + 1);
	return this;
};

// Methods from IEventConsumer

EventSourcedAggregateRoot.prototype.processEvent = function processEvent(event){
	if(!(this.eventHandlers) || typeof(this.eventHandlers[event.type]) !== 'function'){
		throw new Error('Unhandled event type: ' + event.type);
	}
	var handler = this.eventHandlers[event.type];
	handler.call(this, event.payload);
	return this;
};

// Own methods

EventSourcedAggregateRoot.prototype.raiseEvent = function raiseEvent(type, payload){
	if(this._sealed){
		//TODO: Compact the error message below.
		throw new Error('The event-sourced aggregate object has been sealed and will no longer accept events. This usually indicates an attempt to raise new events outside a repository call\'s consistency boundary - a programming error.');
	}
	if(!this._newEvents){
		this._newEvents = [];
	}
	var event = new Event(type, payload);
	this.processEvent(event);
	this._newEvents.push(event);
	return this;
};

EventSourcedAggregateRoot.prototype.seal = function seal(){
	this._sealed = true;
};

module.exports.EventSourcedAggregateRoot = EventSourcedAggregateRoot;