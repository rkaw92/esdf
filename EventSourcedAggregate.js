/**
 * @module esdf/core/EventSourcedAggregate
 */

var EventEmitter = require('events').EventEmitter;
var when = require('when');
var uuid = require('uuid');

/**
 * Basic constructor for creating an in-memory object representation of an Aggregate. Aggregates are basic business objects in the domain and the primary source of events.
 * The created Aggregate instance supports EventEmitter's on() listener registration to define how events alter the state of the Aggregate (and thus, of the application).
 * An aggregate should typically listen to its own events (define event handlers) and react by issuing such state changes, since it is the only keeper of its own internal state.
 * You *are* supposed to use this as a prototype for your own Aggregate constructors.
 * 
 * @constructor
 */
function EventSourcedAggregate(){
	this.init();
}
//use the event emitter prototype to define listener interactions and the emit function
EventSourcedAggregate.prototype = new EventEmitter();

//TODO: document this abomination
EventSourcedAggregate.prototype.init = function init(){
	EventEmitter.call(this);
	/**
	 * Aggregate ID, used when loading (rehydrating) the object from an Event Sink.
	 * @private
	 */
	this.aggregateID = undefined;
	/**
	 * Pending event sequence number, used for event ordering and optimistic concurrency collision detection.
	 * @private
	 */
	this.nextSequenceNumber = 1;
	/**
	 * Array of the events to be saved to the Event Sink within a single commit when commit() is called.
	 * @private
	 */
	this.stagedEvents = [];
	/**
	 * The assigned Event Sink that events will be committed to. This variable should be assigned from the outside using the assignEventSink method.
	 * @public
	 */
	this.eventSink = undefined;
	/**
	 * Currently-running command ID that can be used by the Aggregate's methods to perform internal deduplication for idempotency.
	 * @type {string}
	 * @public
	 */
	this.currentCommandID = undefined;
	
	this._events = {};
};

/**
 * Helper function, used mainly by Event Sink implementations to apply batches of events without duplicating code.
 * 
 * @param {Array} event_array The array of events to apply. Each array element must be an object with at least EventType and EventObject properties, which will be used when applying.
 */
EventSourcedAggregate.prototype.applyCommit = function applyCommit(eventArray){
	for(var i = 0; i < eventArray.length; i++){
		this.apply(eventArray[i].EventType, eventArray[i].EventObject);
	}
	this.nextSequenceNumber++;
};


/**
 * Apply the event to the Aggregate by calling the appropriate registered event handlers. Also increment the current sequence number.
 * 
 * @param {string} eventType The name of the event to be applied. This is the same name as is used with .on() invocations when registering handlers/listeners.
 * @param {Object} eventParams The payload in form of a JavaScript object. It will be passed to the event handler function as the first argument verbatim.
 */
EventSourcedAggregate.prototype.apply = function apply(eventType, eventParams){
	if(!eventType || !eventParams){
		throw new Error('EventSourcedAggregate.apply requires at least an event name and an event object as its arguments.');
	}
	this.emit.apply(this, arguments); //EventEmitter's actual in-process event publish - pass-through the same arguments that we got to it.
};

/**
 * Stage an event for committing later. Immediately applies the event to the Aggregate (via the built-in EventEmitter), so rolling back is not possible (reloading the Aggregate from the Event Sink and retrying can be used instead, see utils.tryWith).
 * 
 * @param {string} eventType Type of the event to apply. This is the name used both for routing the event to local listeners (including the Aggregate's own) and saving it to the Event Sink.
 * @param {Object} eventParams The event payload to pass to local listeners and the Event Sink.
 */
EventSourcedAggregate.prototype.stage = function stage(eventType, eventParams){
	if(!eventParams){
		eventParams = {};
	}
	this.stagedEvents.push({
		EventID: uuid.v4(),
		EventType: eventType,
		EventObject: eventParams
	});
	this.apply(eventType, eventParams);
	return true;
};

/**
 * Save all staged events to the Event Sink (assigned earlier manually from outside to the Aggregate's "eventSink" property).
 * Emits an "error" event should any saving errors occur (allowing higher layers to reload the Aggregate and retry whatever they were doing with it).
 * In case no events were actually staged, this function will not attempt to sink an empty commit, resolving the sink promise immediately.
 * 
 * @returns {Promise} Promise/A-compliant promise object which supports then(). The promise is resolved when the commit is saved, and rejected if the saving fails for any reason (including optimistic concurrency).
 */
EventSourcedAggregate.prototype.commit = function commit(){
	var self = this;
	var emitDeferred = when.defer(); //emission promise - to be resolved when the event batch is saved in the database
	//Guard clause: if no events staged, do not litter the Event Store (especially useful with the idempotency wrapper deduplicateMethodCall).
	if(self.stagedEvents.length < 1){
		return emitDeferred.resolver.resolve(true);
	}
	// Try to sink the commit.
	when(self.eventSink.sink(self.stagedEvents, self.aggregateID, self.nextSequenceNumber),
	function _commitSinkSucceeded(result){
		self.nextSequenceNumber++;
		self.stagedEvents = [];
		return emitDeferred.resolver.resolve(true);
	},
	function _commitSinkFailed(reason){
		return emitDeferred.resolver.reject(reason);
	}); //This is a promise (thenable), so return its consumer-facing part.
	return emitDeferred.promise;
};

module.exports.EventSourcedAggregate = EventSourcedAggregate;