/**
 * @module esdf/core/EventSourcedAggregate
 */

var EventEmitter = require('eventemitter2').EventEmitter2;
var AggregateSnapshot = require('./utils/AggregateSnapshot.js').AggregateSnapshot;
var when = require('when');
var uuid = require('uuid');
var util = require('util');

var Commit = require('./Commit.js').Commit;

//TODO: Error class documentation.
function AggregateTypeMismatch(expected, got){
	this.name = 'AggregateTypeMismatch';
	this.message = 'Aggregate type mismatch: expected (' + typeof(expected) + ')' + expected + ', got (' + typeof(got) + ')' + got;
	this.labels = {
		expected: expected,
		got: got,
		critical: true // This error precludes retry attempts (assuming a sane retry strategy is employed).
	};
}
util.inherits(AggregateTypeMismatch, Error);

function AggregateUsageError(message){
	this.name = 'AggregateUsageError';
	this.message = message;
	this.labels = {
		critical: true
	};
}
util.inherits(AggregateUsageError, Error);

//TODO: use real, well-defined methods for assigning the EventSink, ID and aggregateType. Refactor the users.
/**
 * Basic constructor for creating an in-memory object representation of an Aggregate. Aggregates are basic business objects in the domain and the primary source of events.
 * The created Aggregate instance supports EventEmitter's on() listener registration to define how events alter the state of the Aggregate (and thus, of the application).
 * An aggregate should typically listen to its own events (define event handlers) and react by issuing such state changes, since it is the only keeper of its own internal state.
 * You *are* supposed to use this as a prototype for your own Aggregate constructors.
 * 
 * @constructor
 */
function EventSourcedAggregate(){
	/**
	 * Aggregate ID, used when loading (rehydrating) the object from an Event Sink.
	 * @private
	 */
	this._aggregateID = undefined;
	/**
	 * Pending event sequence number, used for event ordering and optimistic concurrency collision detection.
	 * @private
	 */
	this._nextSequenceNumber = 1;
	/**
	 * Array of the events to be saved to the Event Sink within a single commit when commit() is called.
	 * @private
	 */
	this._stagedEvents = undefined;
	/**
	 * The assigned Event Sink that events will be committed to. This variable should be assigned from the outside using the assignEventSink method.
	 * @public
	 */
	this._eventSink = undefined;
	/**
	 * Aggregate's proper name - used to check if commits belong here when loading. Validation makes it impossible to apply another class' commits.
	 */
	this._aggregateType = undefined;
}

/**
 * Apply the given commit to the aggregate, causing it to apply each event, individually, one after another.
 * 
 * @param {module:esdf/core/Commit.Commit} commit The commit object to apply.
 */
EventSourcedAggregate.prototype.applyCommit = function applyCommit(commit){
	var self = this;
	//TODO: aggregate type validation.
	// Check if the commit's saved aggregateType matches our own. If not, bail out - this is not our commit for sure!
	if(this._aggregateType !== commit.aggregateType){
		throw new AggregateTypeMismatch(this._aggregateType, commit.aggregateType);
	}
	commit.events.forEach(function(event){
		// The handler only gets the event and the commit metadata. It is not granted access to other events in the commit.
		self._applyEvent(event, commit);
	});
	// Increment our internal sequence number counter.
	this._nextSequenceNumber++;
};


/**
 * Apply the event to the Aggregate by calling the appropriate registered event handlers.
 * 
 * @param {module:esdf/core/Event.Event} event The event to apply.
 * @param {module:esdf/core/Commit.Commit} commit The commit that the event is part of.
 * 
 */
//TODO: document the handler function contract using JSDoc or any other means available.
EventSourcedAggregate.prototype._applyEvent = function _applyEvent(event, commit){
	var handlerFunctionName = 'on' + event.eventType;
	if(typeof(this[handlerFunctionName]) === 'function'){
		this[handlerFunctionName](event, commit);
	}
	else{
		throw new AggregateDefinitionError('Event type ' + event.eventType + ' applied, but no handler was available - bailing out to avoid programmer error!');
	}
};

/**
 * Stage an event for committing later. Immediately applies the event to the Aggregate (via the built-in EventEmitter), so rolling back is not possible (reloading the Aggregate from the Event Sink and retrying can be used instead, see utils.tryWith).
 * 
 * @param {module:esdf/core/Event.Event} event The event to be enqueued for committing later.
 */
EventSourcedAggregate.prototype._stageEvent = function _stageEvent(event){
	// If this is the first call, we need to initialize the pending event array.
	//  It can not be done via prototypes, because that would mean the array is shared among all instances (a big problem!).
	if(!this._stagedEvents){
		this._stagedEvents = [];
	}
	this._stagedEvents.push(event);
	this._applyEvent(event);
	return true;
};

//TODO: documentation (especially concerning the hack below)
EventSourcedAggregate.prototype._getSnapshotData = function _getSnapshotData(){
	throw new AggregateDefinitionError('Unimplemented!');
};
EventSourcedAggregate.prototype._getSnapshotData.unimplemented = true;

EventSourcedAggregate.prototype.applySnapshot = function applySnapshot(snapshot){
	if(AggregateSnapshot.isAggregateSnapshot(snapshot)){
		if(typeof(this._applySnapshot) === 'function'){
			if(snapshot.aggregateType === this._aggregateType){
				this._applySnapshot(snapshot);
				this._nextSequenceNumber = snapshot.lastSlotNumber + 1;
			}
			else{
				throw new AggregateTypeMismatch(this._aggregateType, snapshot.aggregateType);
			}
		}
		else{
			throw new AggregateUsageError('This aggregate does not support snapshot application (needs to implement _applySnapshot).');
		}
	}
	else{
		throw new AggregateUsageError('Not a snapshot object - can not apply!');
	}
};

EventSourcedAggregate.prototype.supportsSnapshots = function supportsSnapshots(){
	return (typeof(this._applySnapshot) === 'function');
};

/**
 * Save all staged events to the Event Sink (assigned earlier manually from outside to the Aggregate's "_eventSink" property).
 * Emits an "error" event should any saving errors occur (allowing higher layers to reload the Aggregate and retry whatever they were doing with it).
 * @param {Object} metadata
 * @returns {external:Promise} Promise/A-compliant promise object which supports then(). The promise is resolved when the commit is saved, and rejected if the saving fails for any reason (including optimistic concurrency).
 */
EventSourcedAggregate.prototype.commit = function commit(metadata){
	if(typeof(metadata) !== 'object' || metadata === null){
		metadata = {};
	}
	var self = this;
	var emitDeferred = when.defer(); //emission promise - to be resolved when the event batch is saved in the database
	// NOTE: Sinking an empty commit *is a valid operation* from the AR's point of view! It is up to the eventSink how it handles this.
	// Try to sink the commit.
	if(!this._stagedEvents){
		this._stagedEvents = [];
	}
	var commitObject = new Commit(this._stagedEvents, this._aggregateID, this._nextSequenceNumber, this._aggregateType, metadata);
	when(self._eventSink.sink(commitObject),
	function _commitSinkSucceeded(result){
		self._stagedEvents = [];
		self._nextSequenceNumber = self._nextSequenceNumber + 1;
		return emitDeferred.resolver.resolve(result);
	},
	function _commitSinkFailed(reason){
		return emitDeferred.resolver.reject(reason);
	}); //This is a promise (thenable), so return its consumer-facing part.
	return emitDeferred.promise;
};

EventSourcedAggregate.prototype.saveSnapshot = function saveSnapshot(){
	var self = this;
	if(typeof(this._getSnapshotData) === 'function' && !this._getSnapshotData.unimplemented){
		return this._snapshotter.saveSnapshot(new AggregateSnapshot(this._aggregateType, this._aggregateID, this._getSnapshotData(), (this._nextSequenceNumber - 1)));
	}
	else{
		//TODO: Construct an error here? Or just leave as undefined?
		return when.reject();
	}
};

module.exports.EventSourcedAggregate = EventSourcedAggregate;