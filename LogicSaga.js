/**
 * @module esdf/core/LogicSaga
 */
var EventSourcedAggregate = require('./EventSourcedAggregate.js').EventSourcedAggregate;
var Event = require('./Event.js').Event;
var util = require('util');
var when = require('when');
var whenFunctions = require('when/function');

function LogicSagaTimerIDConflictError(id){
	this.name = 'LogicSagaTimerIDConflictError';
	this.message = 'This timer ID (' + id + ') has already been used by this saga - it may not be re-used.';
	this.data = {
		id: id
	};
}
util.inherits(LogicSagaTimerIDConflictError, Error);

function LogicSagaTimerHandlerMissingError(timerID, timerType){
	this.name = 'LogicSagaTimerHandlerMissingError';
	this.message = 'There is no handler defined for this type of timer (' + timerType + ') - bailing out.';
	this.data = {
		timerID: timerID,
		timerType: timerType
	};
}

//TODO: LogicSaga API documentation & overview.
function LogicSaga(){
	//TODO: Find a way to document the ensured members without duplicating code. Using JSDoc3 should also be possible in non-constructor functions...
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
	/**
	 * A map of timers that have been activated by this saga. Time-dependent triggers use the timer IDs to signal that the time has elapsed.
	 * Keyed by timer ID, the values represent the timer types (defined by the saga implementation for its own use).
	 * The timer types correspond to timer trigger handlers.
	 * @type {Object.<string,string>}
	 */
	this._activeTimers = {};
	/**
	 * A set of timer IDs that have been processed in the past. Does not include active timers.
	 */
	this._processedTimers = {};
}
util.inherits(LogicSaga, EventSourcedAggregate);
LogicSaga.prototype._aggregateType = 'LogicSaga';

LogicSaga.prototype._ensureMembers = function _ensureMembers(){
	if(!this._seenEventIDs){
		this._seenEventIDs = {};
	}
	if(!this._acceptedEvents){
		this._acceptedEvents = [];
	}
	if(!this._activeTimers){
		this._activeTimers = [];
	}
	if(!this._processedTimers){
		this._processedTimers = {};
	}
};

LogicSaga.prototype._switchStage = function _switchStage(newStageName){
	this._currentStage = String(newStageName);
	this._acceptedEvents = [];
};

LogicSaga.prototype._setupTimer = function _setupTimer(timerID, timerType, plannedTriggerTime, setupTime){
	// Guard clause: check whether the timer is already active or has been used in the past.
	if(this._activeTimers.indexOf(timerID) >= 0 || this._processedTimers[timerID]){
		throw new LogicSagaTimerIDConflictError(timerID);
	}
	this._stageEvent(new Event('TimerSetup', {
		timerID: timerID,
		timerType: timerType,
		setupTime: setupTime ? (new Date(setupTime)) : (new Date()), // Audit purposes only
		plannedTriggerTime: new Date(plannedTriggerTime)
	}));
};

//TODO: Let the user provide custom handling for timers by declaring this function abstract (at least in the doc...).
LogicSaga.prototype.handleTimer = function handleTimer(timerID, actualTriggerTime, deps){
	var self = this;
	// NOTE: Dynamic dispatch! Watch out for name collisions!
	var timerType = this._activeTimers[timerID];
	var timerHandlerName = 'handle' + timerType + 'Timer';
	this._finishTimer(timerID, actualTriggerTime);
	if(typeof(this[timerHandlerName]) === 'function'){
		return whenFunctions.call(this[timerHandlerName].bind(this), timerID, actualTriggerTime, deps);
	}
	else{
		throw new LogicSagaTimerHandlerMissingError(timerID, timerType);
	}
};

LogicSaga.prototype._finishTimer = function _finishTimer(timerID, actualTriggerTime){
	this._stageEvent(new Event('TimerFinished', {
		timerID: String(timerID),
		actualTriggerTime: new Date(actualTriggerTime)
	}));
};

LogicSaga.prototype.onEventProcessed = function onEventProcessed(event, commit){
	this._acceptedEvents.push(event.eventPayload.event);
};

LogicSaga.prototype.onTimerSetup = function onTimerSetup(event, commit){
	this._activeTimers[event.eventPayload.timerID] = event.eventPayload.timerType;
};

LogicSaga.prototype.onTimerFinished = function onTimerFinished(event, commit){
	var timerID = event.eventPayload.timerID;
	this._activeTimers = this._activeTimers.filter(function _removeFinishedTimer(timerEntry){
		return timerEntry !== timerID;
	});
	this._processedTimers[timerID] = true;
};

LogicSaga.prototype.processEvent = function processEvent(event, commit, environment){
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

LogicSaga.getBinds = function getBinds(){
	return [];
};

LogicSaga.route = function route(event, commit){
	throw new Error('The routing function needs to be overloaded by child prototypes - refusing to act with the default routing function');
};

module.exports.LogicSaga = LogicSaga;