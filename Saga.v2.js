var EventSourcedAggregate = require('./EventSourcedAggregate').EventSourcedAggregate;
var Event = require('./Event').Event;
var util = require('util');
var when = require('when');

// ### Error types ###
function TransitionConflictError(){
	this.message = 'Transition conflict detected - will not proceed with state transition';
	this.name = 'TransitionConflictError';
}
util.inherits(TransitionConflictError, Error);

function EventTypeNotAccepted(){
	this.message = 'The saga does not accept this type of events at this stage - perhaps try processing at a later stage?';
	this.name = 'EventTypeNotAccepted';
}
util.inherits(EventTypeNotAccepted, Error);

// ### Helper types ###
function SagaStage(name, acceptedEventTypes){
	this.name = name;
	this.transitions = {};
	this.acceptedEventTypes = acceptedEventTypes;
}
SagaStage.prototype.addTransition = function addTransition(transition){
	this.transitions[transition.name] = transition;
	// Allow method chaining.
	return this;
};
SagaStage.prototype.handleEvent = function handleEvent(event, commit, queuedEvents, accumulator, sagaAccumulator){
	var specificMethodName = 'on' + event.eventType;
	if(typeof(this[specificMethodName]) === 'function'){
		this[specificMethodName](event, commit, queuedEvents, accumulator, sagaAccumulator);
	}
	else{
		if(typeof(this.defaultEventHandler) === 'function'){
			this.defaultEventHandler(event, commit, queuedEvents, accumulator, sagaAccumulator);
		}
	}
};

function SagaTransition(name, eventAcceptorFunction, actionFunction, transitionEventType, eventPayloadGenerator){
	this.destination = null;
	this.eventEndsTransition = eventAcceptorFunction;
	this.performAction = actionFunction || function(event, commit, queuedEvents, stageAccumulator, sagaAccumulator, environment){};
	this.transitionEventType = transitionEventType;
	this.eventPayloadGenerator = (typeof(eventPayloadGenerator) === 'function') ? eventPayloadGenerator : function(event, commit, queuedEvents, accumulator, globalAccumulator, actionResult){
		return {};
	};
}

SagaTransition.prototype.setDestination = function setDestination(destination){
	this.destination = destination;
	// Allow method chaining.
	return this;
};

// ### Aggregate definition ###

function Saga(){
	
}
util.inherits(Saga, EventSourcedAggregate);

Saga.prototype._init = function _init(initialStage){
	this._currentStage = initialStage;
	this._currentStagePath = initialStage.name;
	this._stageAccumulator = {};
	this._globalAccumulator = {};
	this._enqueuedEvents = [];
	this._seenEventIDs = {};
	this._error = null;
	this._allowMissingEventHandlers = true;
};

Saga.prototype.processEvent = function processEvent(event, commit, environment){
	var self = this;
	// Guard clause: do not process duplicate events.
	if(this._seenEventIDs[event.eventID]){
		return when.resolve();
	}
	if(this._currentStage.acceptedEventTypes.indexOf(event.eventType) < 0){
		return when.reject(new EventTypeNotAccepted('The saga does not accept this type of events at this stage - perhaps try processing at a later stage?'));
	}
	// Gather all transitions that are to occur. We use each transition's supplied decision function.
	var transitionIntents = [];
	for(var transitionKey in this._currentStage.transitions){
		var currentTransition = this._currentStage.transitions[transitionKey];
		var transitionDecision = currentTransition.eventEndsTransition(event, commit, this._enqueuedEvents, this._stageAccumulator, this._globalAccumulator);
		if(transitionDecision){
			transitionIntents.push(currentTransition);
		}
	}
	// Check if any transitions have been marked for passing.
	if(transitionIntents.length > 0){
		// There is at least one nominated transition.
		// Check for conflicts.
		if(transitionIntents.length > 1){
			//TODO: Define the event payload below in a better way.
			//TODO: Reconsider whether it makes sense at all to stage events if we are likely not going to commit them (as the processing yields a promise rejection).
			this._stageEvent('TransitionConflictDetected', {currentStage: this._currentStage.name, currentEventType: event.eventType});
			return when.reject(new TransitionConflictError('Transition conflict detected - will not proceed with state transition'));
		}
		var transition = transitionIntents[0];
		return when(transition.performAction(event, commit, this._enqueuedEvents, this._stageAccumulator, this._globalAccumulator, environment),
		function _finalizeTransition(actionResult){
			if(transition.transitionEventType){
				self._stageEvent(new Event(transition.transitionEventType, transition.eventPayloadGenerator(event, commit, self._enqueuedEvents, self._stageAccumulator, self._globalAccumulator, actionResult)));
			}
			self._stageEvent(new Event('TransitionCompleted', {transitionName: transition.name, event: event, commit: commit}));
			return when.resolve(actionResult);
		},
		function _cancelTransition(reason){
			return when.reject(reason);
		});
	}
	else{
		// No transitions - simply enqueue the event.
		this._stageEvent(new Event('EventEnqueued', {event: event}));
		return when.resolve();
	}
};

Saga.prototype.onEventEnqueued = function onEventEnqueued(event, commit){
	this._enqueuedEvents.push(event);
	this._currentStage.handleEvent(event, commit, this._enqueuedEvents, this._stageAccumulator, this._globalAccumulator);
};

Saga.prototype.onTransitionCompleted = function onTransitionCompleted(event, commit){
	var transitionName = event.eventPayload.transitionName;
	this._currentStage.handleEvent(event.eventPayload.event, event.eventPayload.commit, this._enqueuedEvents, this._stageAccumulator, this._globalAccumulator);
	this._currentStage = this._currentStage.transitions[transitionName].destination;
	this._currentStagePath += '.' + transitionName;
	this._enqueuedEvents = [];
	this._stageAccumulator = {};
};

Saga.prototype._getSnapshotData = function _getSnapshotData(){
	return {
		stagePath: this._currentStagePath,
		enqueuedEvents: this._enqueuedEvents,
		stageAccumulator: this._stageAccumulator,
		globalAccumulator: this._globalAccumulator,
		seenEventIDs: Object.keys(this._seenEventIDs)
	};
};

// Helper functions for Saga users.
Saga.eventTypesSeen = function eventTypesSeen(requiredEventTypes){
	function isContainedIn(containee, container){
		return containee.every(function(element){
			return container.indexOf(element) >= 0;
		});
	}
	return function _eventTypesSeen(event, commit, queuedEvents){
		var seenEventTypes = queuedEvents.concat(event).map(function(ev){
			return ev.eventType;
		});
		return isContainedIn(requiredEventTypes, seenEventTypes);
	};
};

module.exports.SagaStage = SagaStage;
module.exports.SagaTransition = SagaTransition;
module.exports.Saga = Saga;