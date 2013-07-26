/**
 * @module esdf/core/Saga
 */

var EventSourcedAggregate = require('./EventSourcedAggregate.js').EventSourcedAggregate;
var when = require('when');

/**
 * Construct a Saga. Sagas are the basic keepers of long-lived transactions in event-based systems.
 * They act as Finite State Machines, listening to events and either switching their internal state (via events) or executing commands.
 * Sagas are actual Aggregate Roots - their only venue of changing their state is via event emission.
 */
function Saga(){
	// Decouple all properties from the prototype by calling the "parent" constructor.
	EventSourcedAggregate.call(this);
	// Create some storage for: transition definitions, current event space (the set of events expected for any transition).
	this._currentState = '_';
	/**
	 * The list of transitions which are possible from here. Contains copies of remaining events, so that they can be removed until all are (and a transition is initiated).
	 */
	this._possibleTransitions = [];
	/**
	 * A map of all processed event IDs for duplicate avoidance.
	 */
	this._processedEventIDs = {};
	
	var self = this;
	function applyTransition(transitionMetadata){
		console.log('Saga.applyTransition');
		// Change the state.
		self._currentState = transitionMetadata.newState;
		// Register the event as seen, just like in the "hold" case.
		self._processedEventIDs[transitionMetadata.eventID] = true;
		// Reset the current events, so that a new transition may take place later.
		self._currentEvents = [];
		// Copy the transition definitions to the current transition cache and do other cleanup work.
		refreshState();
	}
	
	// Helper function: copy the transitions and their events to a new, unshared store.
	function refreshState(){
		self._possibleTransitions = [];
		for(var transitionIndex = 0; transitionIndex < self._states[self._currentState].transitions.length; ++transitionIndex){
			var transition = self._states[self._currentState].transitions[transitionIndex];
			// Initialize the new variable that we'll push() onto _possibleTransitions later.
			var possibleTransition = {
				destination: transition.destination,
				action: transition.action,
				outputEventType: transition.outputEventType,
				remainingEvents: []
			};
			// Populate the list of remaining events that will be subsequently decreased, until it hits a count of zero, at which point this particular transition takes place.
			for(var eventIndex = 0; eventIndex < transition.requiredEvents.length; ++eventIndex){
				// Place the event specification into the list of remaining events.
				var event = transition.requiredEvents[eventIndex];
				possibleTransition.remainingEvents.push(event);
			}
			// Now that the transition specification is complete, add it to the list of transitions possible from the current state.
			self._possibleTransitions.push(possibleTransition);
			// Additionally, if the spec contained an outputEventType (which overrides SagaStateTransitioned for initiating transitions), register a handler for that event type.
			if(possibleTransition.outputEventType){
				// Duplicate handlers are checked, in order to avoid double state refresh (which would result in excessive event handler populations -> memory leak via avalanche effect after a few transitions).
				//  This check is somewhat strange due to EventEmitter's listener function wrapping when using once().
				if(!self.listeners(possibleTransition.outputEventType).some(function(listenerFunction){ return listenerFunction === applyTransition || listenerFunction.listener === applyTransition; })){
					// The listener is not yet present, so add it.
					self.once(possibleTransition.outputEventType, applyTransition);
				}
			}
		}
	};
	
	// Call the state refresher initially, so that the current transition list is initialized properly.
	// BUG: "this" is set to undefined in the function. WTF?
	refreshState.call(this);
	
	// Set up an event handler to facilitate state transitions.
	this.on('SagaEventPutOnHold', function(eventEnvelope){
		// Add the event to the waiting line.
		this._currentEvents.push(eventEnvelope);
		this._processedEventIDs[eventEnvelope.eventID] = true;
	});
	// Set up a listener to refresh our listeners etc. when a state transition occurs (generic event only).
	this.on('SagaStateTransitioned', applyTransition);
};

Saga.prototype = new EventSourcedAggregate();
/**
 * TODO: doc
 */
Saga.prototype._states = {
	'_': {
		transitions: []
	}
};

//TODO: documentation
Saga.prototype.processEvent = function processEvent(eventEnvelope){
	console.log('Saga.processEvent:', eventEnvelope);
	//Guard clause: deduplicate the event processing.
	if(this._processedEventIDs[eventEnvelope.eventID]){
		return when.defer().resolver.resolve();
	}
	// Iterate through all transitions possible at the moment. The transition objects contain dynamic lists of events still required for transition completion.
	//  (Maybe it's because _possibleTransitions is empty?)
	for(var transitionIndex = 0; transitionIndex < this._possibleTransitions.length; ++transitionIndex){
		var transition = this._possibleTransitions[transitionIndex];
		// Iterate through the specifications of all events remaining for this transition.
		for(var specIndex = 0; specIndex < transition.remainingEvents.length; ++specIndex){
			var spec = transition.remainingEvents[specIndex];
			// Check if the event spec matches (event type and the predicate, if present, must match).
			if(spec.eventType === eventEnvelope.eventType && (!spec.predicate || spec.predicate(eventEnvelope) === true)){
				console.log('Event matched in saga:', eventEnvelope.eventType);
				// Found a match. Two cases now: either there are still some events required for a transition (1) or there are none left and the transition can occur (2).
				if(transition.remainingEvents.length > 1){
					// Case 1 - more events still needed; just queue this one.
					this._stageEvent(new Event('SagaEventPutOnHold', eventEnvelope));
					// Return a (resolved) promise to make callers that expect a Promise/A-compliant object happy.
					return when.defer().resolver.resolve();
				}
				else{
					// Case 2 - this is the last one; initiate transition.
					// Before the transition is completed, the action function needs to be called. This is the "muscle" of the whole Saga (sorry, Team Jacob...).
					var action = (typeof(transition.action) === 'function') ? transition.action : function(){};
					// Instantiate the promise ("deferred") that will be given to the caller. The caller should wait for it before committing or calling processEvent again.
					var callerDeferred = when.defer();
					var self = this;
					// Try executing the action and resolve/reject the promise based on the outcome.
					// NOTE: The action has access to the SequenceID and SequenceNumber that we got from the EventSource, since they got copied over from eventEnvelope.
					when(action.call(this, eventEnvelope),
					function _sagaTransitionActionResolved(result){
						transitionEvent.newState = transition.destination;
						transitionEvent.actionResult = result;
						self._stageEvent(new Event((transition.outputEventType ? transition.outputEventType : 'SagaStateTransitioned'), eventEnvelope));
						callerDeferred.resolver.resolve();
					},
					// In case of failure, and for progress notifications, set up a simple pass-through to the caller via the promise.
					callerDeferred.resolver.reject,
					callerDeferred.resolver.notify
					);
					// End the loop (and the function) - since the transition has been initiated and is possibly pending completion, no other transition should result from this event, nor is queueing the latter necessary.
					//  The consumer gets the promise, whose resolution guarantees that the action has been carried out and the transition event is staged.
					return callerDeferred.promise;
				}
			}
		}
	}
	// If we ended up here, that means nothing interesting happened (no event put on hold, no state transition).
	return when.defer().resolve();
};

module.exports.Saga = Saga;