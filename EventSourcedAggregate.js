/**
 * @module esdf/core/EventSourcedAggregate
 */

var AggregateSnapshot = require('./utils/AggregateSnapshot.js').AggregateSnapshot;
var SnapshotStrategy = require('./utils/SnapshotStrategy.js');
var when = require('when');
var uuid = require('uuid');
var util = require('util');

var Commit = require('./Commit.js').Commit;

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

/*
 * Event handler missing. An EventSourcedAggregate typically needs to implement on* handlers for all event types that it emits.
 * You can disable this check by setting _allowMissingEventHandlers to true in the aggregate - this will let missing event handlers go unnoticed.
 */
function AggregateEventHandlerMissingError(message){
	this.name = 'AggregateEventHandlerMissingError';
	this.message = message;
	this.labels = {
		critical: true
	};
}
util.inherits(AggregateEventHandlerMissingError, Error);

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
	/**
	 * The object whose emit(operationOutcomeName, operationDetails) method shall be called when I/O operations finish or fail.
	 * Supported operation names are ['CommitSinkSuccess', 'CommitSinkFailure', 'SnapshotSaveSuccess' 'SnapshotSaveFailure'].
	 * For CommitSinkSuccess and CommitSinkFailure, the following fields in the operationDetails object are defined:
	 *   commitObject: contains the complete commit object which was due to be saved
	 * Additionally, CommitSinkFailure defines the following fields:
	 *   failureReason: an error (from a lower layer - not necessarily an Error object) explaining why the sink operation failed
	 * For SnapshotSaveSuccess and SnapshotSaveFailure, the following fields in the operationDetails object are defined:
	 *   snapshotObject: contains the complete snapshot object which was due to be saved
	 * Additionally, SnapshotSaveFailure defines the following fields:
	 *   failureReason: an error (from a lower layer - not necessarily an Error object) explaining why the save operation failed
	 * @type {external:EventEmitter}
	 */
	this._IOObserver = null;
}

/**
 * Set the Event Sink to be used by the aggregate during commit.
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink The Event Sink object to use.
 */
EventSourcedAggregate.prototype.setEventSink = function setEventSink(eventSink){
	this._eventSink = eventSink;
};

/**
 * Get the Event Sink in use.
 * @returns {module:esdf/interfaces/EventSinkInterface}
 */
EventSourcedAggregate.prototype.getEventSink = function getEventSink(){
	return this._eventSink;
};

/**
 * Set the Aggregate ID of the instance. Used when saving commits, to mark as belonging to a particular entity.
 * @param {string} aggregateID The identity (aggregate ID) to assume when committing.
 */
EventSourcedAggregate.prototype.setAggregateID = function setAggregateID(aggregateID){
	this._aggregateID = aggregateID;
};

/**
 * Get the Aggregate ID used when committing.
 * @returns {string}
 */
EventSourcedAggregate.prototype.getAggregateID = function getAggregateID(){
	return this._aggregateID;
};

/**
 * Set the snapshotter to use when committing. Setting a snapshotter is optional, and if available,
 *  it is only used when indicated by the snapshot strategy employed by the aggregate.
 * @param {module:esdf/interfaces/AggregateSnapshotter} snapshotter The snapshotter object whose snapshot saving service to use.
 */
EventSourcedAggregate.prototype.setSnapshotter = function setSnapshotter(snapshotter){
	this._snapshotter = snapshotter;
};

/**
 * Get the snapshotter object in use.
 * @returns {module:esdf/interfaces/AggregateSnapshotter}
 */
EventSourcedAggregate.prototype.getSnapshotter = function getSnapshotter(){
	return this._snapshotter;
};

/**
 * Get the sequence number that will be used when saving the next commit. For a cleanly-initialized aggregate, this equals 1.
 * @returns {number}
 */
EventSourcedAggregate.prototype.getNextSequenceNumber = function getNextSequenceNumber(){
	return this._nextSequenceNumber;
};

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
	this.updateSequenceNumber(commit.sequenceSlot);
};

/**
 * Conditionally increase the internal next sequence number if the passed argument is greater or equal to it. Sets the next sequence number to the last commit number + 1.
 * @param {number} lastCommitNumber The number of the processed commit.
 */
EventSourcedAggregate.prototype.updateSequenceNumber = function updateSequenceNumber(lastCommitNumber){
	if(typeof(this._nextSequenceNumber) !== 'number'){
		this._nextSequenceNumber = 1;
	}
	if(Number(lastCommitNumber) >= this._nextSequenceNumber){
		this._nextSequenceNumber = Number(lastCommitNumber) + 1;
	}
};

/**
 * Apply the event to the Aggregate by calling the appropriate registered event handlers.
 * 
 * @param {module:esdf/core/Event.Event} event The event to apply.
 * @param {module:esdf/core/Commit.Commit} commit The commit that the event is part of.
 */
//TODO: Document the "on*" handler function contract using JSDoc or any other means available.
EventSourcedAggregate.prototype._applyEvent = function _applyEvent(event, commit){
	var handlerFunctionName = 'on' + event.eventType;
	if(typeof(this[handlerFunctionName]) === 'function'){
		this[handlerFunctionName](event, commit);
	}
	else{
		if(!this._allowMissingEventHandlers){
			throw new AggregateEventHandlerMissingError('Event type ' + event.eventType + ' applied, but no handler was available - bailing out to avoid programmer error!');
		}
	}
};

/**
 * Apply the event to the Aggregate from an outside source (i.e. non-intrinsic).
 * 
 * @param {module:esdf/core/Event.Event} event The event to apply.
 * @param {module:esdf/core/Commit.Commit} commit The commit that the event is part of.
 */
EventSourcedAggregate.prototype.applyEvent = function applyEvent(event, commit){
	this._applyEvent(event, commit);
	this.updateSequenceNumber(commit.sequenceSlot);
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
				this.updateSequenceNumber(snapshot.lastSlotNumber);
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
	if(typeof(this._nextSequenceNumber) !== 'number'){
		this._nextSequenceNumber = 1;
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
		self.updateSequenceNumber(commitObject.sequenceSlot);
		//NOTE: The check below is a good candidate for refactoring into Aspect-Oriented Programming.
		// ESDF Core does not support AOP as of now, though.
		if(self._IOObserver){
			self._IOObserver.emit('CommitSinkSuccess', {
				commitObject: commitObject
			});
		}
		// Now that the commit has been saved, we proceed to save a snapshot if the snapshotting strategy tells us to (and we have a snapshot save provider).
		//  Note that _snapshotStrategy is called with "this" set to the current aggregate, which makes it behave like a private method.
		if(self.supportsSnapshotGeneration() && self._snapshotter && self._snapshotStrategy(commitObject)){
			self._saveSnapshot();
			// Since saving a snapshot is never mandatory for correct operation of an event-sourced application, we do not have to react to errors.
		}
		return emitDeferred.resolver.resolve(result);
	},
	function _commitSinkFailed(reason){
		if(self._IOObserver){
			self._IOObserver.emit('CommitSinkFailure', {
				commitObject: commitObject,
				failureReason: reason
			});
		}
		return emitDeferred.resolver.reject(reason);
	}); //This is a promise (thenable), so return its consumer-facing part.
	return emitDeferred.promise;
};

/**
 * Save a snapshot of the current aggregate state.
 * The aggregate needs to support snapshot generation, as determined by its supportsSnapshotGeneration() method's return value.
 * @returns {external:Promise} the promise that snapshot save will be carried out.
 */
EventSourcedAggregate.prototype._saveSnapshot = function _saveSnapshot(){
	var self = this;
	if(this.supportsSnapshotGeneration()){
		var snapshotObject = new AggregateSnapshot(this._aggregateType, this._aggregateID, this._getSnapshotData(), (this._nextSequenceNumber - 1));
		return this._snapshotter.saveSnapshot(snapshotObject).then(
		function _snapshotSaveSuccess(){
			if(self._IOObserver){
				self._IOObserver.emit('SnapshotSaveSuccess', {snapshotObject: snapshotObject});
			}
			return when.resolve();
		},
		function _snapshotSaveFailure(reason){
			if(self._IOObserver){
				self._IOObserver.emit('SnapshotSaveFailure', {
					snapshotObject: snapshotObject,
					failureReason: reason
				});
			}
			return when.reject();
		});
	}
	else{
		return when.reject(new AggregateUsageError('An aggregate needs to implement _getSnapshotData in order to be able to save snapshots'));
	}
};

module.exports.EventSourcedAggregate = EventSourcedAggregate;
