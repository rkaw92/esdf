/**
 * @module esdf/core/Saga
 */
var EventSourcedAggregate = require('./EventSourcedAggregate.js').EventSourcedAggregate;
var Event = require('./Event.js').Event;
var util = require('util');
var when = require('when');
var whenFunctions = require('when/function');

//TODO: Saga API documentation & overview.
function Saga(){
	this._ensureMembers();
	/**
	 * Functions used to handle incoming events and direct transitions to further stages. Keyed by stage name.
	 *  This is the de facto stage definition mechanism.
	 * @type {Object.<string,function>}
	 */
	this._stageHandlers = {};
	/**
	 * Name of the current stage handler that should be used. Corresponds to a key from the _stageHandlers map.
	 * @type {string}
	 */
	this._currentStage = undefined;
}
util.inherits(Saga, EventSourcedAggregate);
Saga.prototype._aggregateType = 'Saga';

Saga.prototype._ensureMembers = function _ensureMembers(){
	if(!this._seenEventIDs){
		this._seenEventIDs = {};
	}
	if(!this._acceptedEvents){
		this._acceptedEvents = [];
	}
};

Saga.prototype._switchStage = function _switchStage(newStageName){
	this._currentStage = String(newStageName);
	this._acceptedEvents = [];
};

Saga.prototype.onEventProcessed = function onEventProcessed(event, commit){
	this._acceptedEvents.push(event.eventPayload.event);
};

Saga.prototype.processEvent = function processEvent(event, commit, environment){
	var self = this;
	this._ensureMembers();
	// Guard clause: catch duplicate events and disregard them. The promise is resolved, so that the upper layers may release responsibility for the event, too.
	if(this._seenEventIDs[event.eventID]){
		return when.resolve();
	}
	// First, mark the event as processed:
	self._stageEvent(new Event('EventProcessed', {
		event: event,
		commit: commit
	}));
	// Obtain the stage handler that we should use.
	var currentHandler = this._stageHandlers[this._currentStage];
	// Run the handler and get a promise that will eventually indicate the transition (or the lack of) to be performed.
	var transitionPromise = currentHandler.call(this, event, commit, environment);
	return when(transitionPromise).then(
	function _transitionDecisionReached(transitionEvent){
		// Next, act upon the transition decision:
		if(typeof(transitionEvent) === 'object' && transitionEvent !== null && typeof(transitionEvent.eventType) === 'string' && transitionEvent.eventType.length > 0){
			// There is a transition to be made. Carry it out.
			self._stageEvent(transitionEvent);
		}
		else{
			// No transition chosen at this time. Do nothing.
		}
		return when.resolve();
	},
	function _eventRejected(reason){
		return when.reject(reason);
	});
};

Saga.getBinds = function getBinds(){
	return [];
};

Saga.route = function route(event, commit){
	throw new Error('The routing function needs to be overloaded by child prototypes - refusing to act with the default routing function');
};

module.exports.Saga = Saga;