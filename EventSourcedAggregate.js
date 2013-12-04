/**
 * @module esdf/core/EventSourcedAggregate
 */

var EventEmitter = require('eventemitter2').EventEmitter2;
var AggregateSnapshot = require('./utils/AggregateSnapshot.js').AggregateSnapshot;
var SnapshotStrategy = require('./utils/SnapshotStrategy.js');
var when = require('when');
var uuid = require('uuid');
var util = require('util');

var Commit = require('./Commit.js').Commit;

//TODO: Error class documentation.
/**
 * Aggregate-event type mismatch. Generated when a commit labelled with another AggregateType is applied to an aggregate.
 * Also occurs when a snapshot type mismatch takes place.
 * This prevents loading an aggregateID as another, unrelated aggregate type and trashing the database or bypassing logic restrictions.
 */
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

/**
 * Generated when an aggregate was attempted to be used incorrectly.
 * This currently only occurs when a snapshot operation is requested, but the aggregate lacks snapshot support.
 */
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
 * An aggregate should typically listen to its own events (define on* event handlers) and react by issuing such state changes, since it is the only keeper of its own internal state.
 * You *are* supposed to use this as a prototype for your own Aggregate constructors (preferably via Node's util.inherits).
 * 
 * @constructor
 */
function EventSourcedAggregate(){
	/**
	 * Aggregate ID, used when loading (rehydrating) the object from an Event Sink.
	 * @type string
	 */
	this._aggregateID = undefined;
	/**
	 * Pending event sequence number, used for event ordering and optimistic concurrency collision detection.
	 * @type number
	 */
	this._nextSequenceNumber = 1;
	/**
	 * Array of the events to be saved to the Event Sink within a single commit when commit() is called.
	 * @type [module:esdf/core/Event]
	 */
	this._stagedEvents = undefined;
	/**
	 * The assigned Event Sink that events will be committed to. This variable should be assigned from the outside using the assignEventSink method.
	 * @type Object
	 */
	this._eventSink = undefined;
	/**
	 * Aggregate's proper type name - used to check if commits belong here when loading. Validation makes it impossible to apply another class's commits.
	 * @type string
	 */
	this._aggregateType = undefined;
	/**
	 * Snapshotting strategy used while committing changes. The default is to save a snapshot every commit (if a snapshotter is at all available).
	 * @type function
	 */
	this._snapshotStrategy = SnapshotStrategy.every(1);
	/**
	 * Whether to ignore missing event handlers when applying events (both online and during rehydration).
	 * For example, if "Done" is the event name and there is no onDone method defined within the aggregate, an error would normally be thrown.
	 * This safety mechanism is in place to catch programmer errors early.
	 * Setting this flag to true will prevent error generation in such cases (when you need events without any handlers).
	 * @type boolean
	 */
		this._allowMissingEventHandlers = false;
}

/**
 * Apply the given commit to the aggregate, causing it to apply each event, individually, one after another.
 * 
 * @param {module:esdf/core/Commit.Commit} commit The commit object to apply.
 */
EventSourcedAggregate.prototype.applyCommit = function applyCommit(commit){
	var self = this;
	// Check if the commit's saved aggregateType matches our own. If not, bail out - this is not our commit for sure!
	if(this._aggregateType !== commit.aggregateType){
		throw new AggregateTypeMismatch(this._aggregateType, commit.aggregateType);
	}
	commit.events.forEach(function(event){
		// The handler only gets the event and the commit metadata. It is not guaranteed to have access to other commit members.
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
		if(!this._allowMissingEventHandlers){
			throw new AggregateDefinitionError('Event type ' + event.eventType + ' applied, but no handler was available - bailing out to avoid programmer error!');
		}
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

/**
 * Apply a snapshot object to the aggregate instance. The aggregate must support snapshot application (can be checked via supportsSnapshots()).
 * After snapshot application, the instance should be indistinguishable from one that has only been processing events.
 * Only the aggregate implementation is responsible for applying snapshots to itself. The framework does not aid state restoration in any way, besides setting appropriate sequence counters.
 * @param {module:esdf/utils/AggregateSnapshot} snapshot The snapshot object to apply.
 */
EventSourcedAggregate.prototype.applySnapshot = function applySnapshot(snapshot){
	if(AggregateSnapshot.isAggregateSnapshot(snapshot)){
		if(this.supportsSnapshotApplication()){
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

/**
 * Check if the aggregate instance supports snapshot application.
 * Note that a passed check does not guarantee support for saving snapshots - only re-applying them on top of an instance.
 * @returns {boolean} whether a snapshot can be applied to this aggregate.
 */
EventSourcedAggregate.prototype.supportsSnapshotApplication = function supportsSnapshotApplication(){
	return (typeof(this._applySnapshot) === 'function');
};

/**
 * Check if the aggregate instance supports snapshot generation.
 * Note that snapshot generation support alone is not enough to guarantee that a snapshot can be re-applied later.
 * @returns {boolean} whether this aggregate can be asked to generate a snapshot of itself.
 */
EventSourcedAggregate.prototype.supportsSnapshotGeneration = function supportsSnapshotGeneration(){
	return (typeof(this._getSnapshotData) === 'function');
};

/**
 * Save all staged events to the Event Sink (assigned earlier manually from outside to the Aggregate's "_eventSink" property).
 * A snapshot save is automatically triggered (in the background) if the snapshotting strategy allows it.
 * @param {Object} metadata The data that should be saved to storage along with the commit object.
 * @returns {external:Promise} Promise/A-compliant promise object which supports then(). The promise is resolved when the commit is saved, and rejected if the saving fails for any reason (including optimistic concurrency).
 */
EventSourcedAggregate.prototype.commit = function commit(metadata){
	if(typeof(metadata) !== 'object' || metadata === null){
		metadata = {};
	}
	var self = this;
	var emitDeferred = when.defer(); //emission promise - to be resolved when the event batch is saved in the database
	// Try to sink the commit. If empty, return success immediately.
	if(!this._stagedEvents){
		this._stagedEvents = [];
	}
	if(this._stagedEvents.length === 0){
		return emitDeferred.resolver.resolve();
	}
	var commitObject = new Commit(this._stagedEvents, this._aggregateID, this._nextSequenceNumber, this._aggregateType, metadata);
	when(self._eventSink.sink(commitObject),
	function _commitSinkSucceeded(result){
		self._stagedEvents = [];
		self._nextSequenceNumber = self._nextSequenceNumber + 1;
		// Now that the commit has been saved, we proceed to save a snapshot if the snapshotting strategy tells us to (and we have a snapshot save provider).
		//  Note that _snapshotStrategy is called with "this" set to the current aggregate, which makes it behave like a private method.
		if(self.supportsSnapshotGeneration() && self._snapshotter && self._snapshotStrategy(commitObject)){
			self.saveSnapshot();
			// Since saving a snapshot is never mandatory for correct operation of an event-sourced application, we do not have to react to errors.
			//TODO: Find a way to get some notification out, so that the snapshot save failure can be logged somewhere. Promise handling (when() wrapping) of te saveSnapshot() above should be included.
		}
		return emitDeferred.resolver.resolve(result);
	},
	function _commitSinkFailed(reason){
		return emitDeferred.resolver.reject(reason);
	}); //This is a promise (thenable), so return its consumer-facing part.
	return emitDeferred.promise;
};

/**
 * Save a snapshot of the current aggregate state.
 * The aggregate needs to support snapshot generation, as determined by its supportsSnapshotGeneration() method's return value.
 * @returns {external:Promise} the promise that snapshot save will be carried out.
 */
EventSourcedAggregate.prototype.saveSnapshot = function saveSnapshot(){
	var self = this;
	if(this.supportsSnapshotGeneration){
		return this._snapshotter.saveSnapshot(new AggregateSnapshot(this._aggregateType, this._aggregateID, this._getSnapshotData(), (this._nextSequenceNumber - 1)));
	}
	else{
		return when.reject(new AggregateDefinitionError('An aggregate needs to implement _getSnapshotData in order to be able to save snapshots'));
	}
};

module.exports.EventSourcedAggregate = EventSourcedAggregate;