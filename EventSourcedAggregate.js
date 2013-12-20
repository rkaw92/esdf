/**
 * @module esdf/core/EventSourcedAggregate
 * @exports module.exports
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
 * @constructor
 * @extends Error
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
 * Event handler missing. An EventSourcedAggregate typically needs to implement on* handlers for all event types that it emits.
 * You can disable this check by setting _allowMissingEventHandlers to true in the aggregate - this will let missing event handlers go unnoticed.
 * @constructor
 * @extends Error
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
 * @constructor
 * @extends Error
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
 * An aggregate should typically listen to its own events (define on\* event handlers) and react by issuing such state changes, since it is the only keeper of its own internal state.
 * You __are__ supposed to extend this prototype (preferably via Node's util.inherits or equivalent, for example CoffeeScript's extends).
 * @constructor
 */
function EventSourcedAggregate(){
	/**
	 * Aggregate ID, used when loading (rehydrating) the object from an Event Sink.
	 * @private
	 * @type string
	 */
	this._aggregateID = undefined;
	/**
	 * Pending event sequence number, used for event ordering and optimistic concurrency collision detection.
	 * @private
	 * @type number
	 */
	this._nextSequenceNumber = 1;
	/**
	 * Array of the events to be saved to the Event Sink within a single commit when commit() is called.
	 * @private
	 * @type module:esdf/core/Event~Event[]
	 */
	this._stagedEvents = undefined;
	/**
	 * The assigned Event Sink that events will be committed to. This variable should be assigned from the outside using the assignEventSink method.
	 * @private
	 * @type Object
	 */
	this._eventSink = undefined;
	/**
	 * Aggregate's proper type name - used to check if commits belong here when loading. Validation makes it impossible to apply another class's commits.
	 * @private
	 * @type string
	 */
	this._aggregateType = undefined;
	/**
	 * Snapshotting strategy used while committing changes. The default is to save a snapshot every commit (if a snapshotter is at all available).
	 * @private
	 * @type function
	 */
	this._snapshotStrategy = SnapshotStrategy.every(1);
	/**
	 * Whether to ignore missing event handlers when applying events (both online and during rehydration).
	 * For example, if "Done" is the event name and there is no onDone method defined within the aggregate, an error would normally be thrown.
	 * This safety mechanism is in place to catch programmer errors early.
	 * Setting this flag to true will prevent error generation in such cases (when you need events without any handlers). It should be done in the aggregate's constructor or prototype, preferably.
	 * @private
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
	 * @private
	 * @type {external:EventEmitter}
	 */
	this._IOObserver = null;
}

/**
 * Set the Event Sink to be used by the aggregate during commit.
 * @method
 * @public
 * @param {module:esdf/interfaces/EventSinkInterface} eventSink The Event Sink object to use.
 */
EventSourcedAggregate.prototype.setEventSink = function setEventSink(eventSink){
	this._eventSink = eventSink;
};

/**
 * Get the Event Sink in use.
 * @method
 * @public
 * @returns {module:esdf/interfaces/EventSinkInterface}
 */
EventSourcedAggregate.prototype.getEventSink = function getEventSink(){
	return this._eventSink;
};

/**
 * Set the Aggregate ID of the instance. Used when saving commits, to mark as belonging to a particular entity.
 * @method
 * @public
 * @param {string} aggregateID The identity (aggregate ID) to assume when committing.
 */
EventSourcedAggregate.prototype.setAggregateID = function setAggregateID(aggregateID){
	this._aggregateID = aggregateID;
};

/**
 * Get the Aggregate ID used when committing.
 * @method
 * @public
 * @returns {string}
 */
EventSourcedAggregate.prototype.getAggregateID = function getAggregateID(){
	return this._aggregateID;
};

/**
 * Set the snapshotter to use when committing. Setting a snapshotter is optional, and if available,
 *  it is only used when indicated by the snapshot strategy employed by the aggregate.
 * @method
 * @public
 * @param {module:esdf/interfaces/AggregateSnapshotterInterface} snapshotter The snapshotter object whose snapshot saving service to use.
 */
EventSourcedAggregate.prototype.setSnapshotter = function setSnapshotter(snapshotter){
	this._snapshotter = snapshotter;
};

/**
 * Get the snapshotter object in use.
 * @method
 * @public
 * @returns {module:esdf/interfaces/AggregateSnapshotterInterface}
 */
EventSourcedAggregate.prototype.getSnapshotter = function getSnapshotter(){
	return this._snapshotter;
};

/**
 * Get the sequence number that will be used when saving the next commit. For a cleanly-initialized aggregate, this equals 1.
 * @method
 * @public
 * @returns {number}
 */
EventSourcedAggregate.prototype.getNextSequenceNumber = function getNextSequenceNumber(){
	return this._nextSequenceNumber;
};

/**
 * Apply the given commit to the aggregate, causing it to apply each event, individually, one after another.
 * @method
 * @public
 * @param {module:esdf/core/Commit~Commit} commit The commit object to apply.
 * @throws {module:esdf/core/EventSourcedAggregate~AggregateTypeMismatch} if the instance's _aggregateType does not equal the commit's saved aggregateType.
 * @throws {module:esdf/core/EventSourcedAggregate~AggregateEventHandlerMissingError} if the handler for at least one of the commit's events is missing (and _allowMissingEventHandlers is false).
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
	this._updateSequenceNumber(commit.sequenceSlot);
};

/**
 * Apply the event to the Aggregate by calling the appropriate registered event handlers.
 * @method
 * @private
 * @param {module:esdf/core/Event~Event} event The event to apply.
 * @throws {module:esdf/core/EventSourcedAggregate~AggregateEventHandlerMissingError} if the handler for the passed event (based on event type) is missing.
 */
//TODO: Document the "on*" handler function contract.
EventSourcedAggregate.prototype._applyEvent = function _applyEvent(event){
	var handlerFunctionName = 'on' + event.eventType;
	if(typeof(this[handlerFunctionName]) === 'function'){
		this[handlerFunctionName](event);
	}
	else{
		if(!this._allowMissingEventHandlers){
			throw new AggregateEventHandlerMissingError('Event type ' + event.eventType + ' applied, but no handler was available - bailing out to avoid programmer error!');
		}
	}
};

/**
 * Conditionally increase the internal next sequence number if the passed argument is greater or equal to it. Sets the next sequence number to the last commit number + 1.
 * @method
 * @private
 * @param {number} lastCommitNumber The number of the processed commit.
 */
EventSourcedAggregate.prototype._updateSequenceNumber = function _updateSequenceNumber(lastCommitNumber){
	if(typeof(this._nextSequenceNumber) !== 'number'){
		this._nextSequenceNumber = 1;
	}
	if(Number(lastCommitNumber) >= this._nextSequenceNumber){
		this._nextSequenceNumber = Number(lastCommitNumber) + 1;
	}
};

/**
 * Apply the event to the Aggregate from an outside source (i.e. non-intrinsic).
 * @method
 * @public
 * @param {module:esdf/core/Event~Event} event The event to apply.
 * @param {?module:esdf/core/Commit~Commit} commit The commit that the event is part of. If provided, the internal next slot number counter is increased to the commit's slot + 1.
 */
EventSourcedAggregate.prototype.applyEvent = function applyEvent(event, commit){
	this._applyEvent(event);
	if(commit && typeof(commit.sequenceSlot) === 'number'){
		this._updateSequenceNumber(commit.sequenceSlot);
	}
};

/**
 * Stage an event for committing later. Immediately applies the event to the Aggregate (via the built-in EventEmitter), so rolling back is not possible
 *  (reloading the Aggregate from the Event Sink and retrying can be used instead, see utils.tryWith).
 * @method
 * @private
 * @param {module:esdf/core/Event~Event} event The event to be enqueued for committing later.
 */
EventSourcedAggregate.prototype._stageEvent = function _stageEvent(event){
	// If this is the first call, we need to initialize the pending event array.
	//  It can not be done via prototypes, because that would mean the array is shared among all instances (a big problem!).
	if(!this._stagedEvents){
		this._stagedEvents = [];
	}
	// Enrich the event using the aggregate's specific enrichment function.
	this._enrichEvent(event);
	this._stagedEvents.push(event);
	this._applyEvent(event);
	return true;
};

/**
 * Apply a snapshot object to the aggregate instance. The aggregate must support snapshot application (can be checked via supportsSnapshotApplication()).
 * After snapshot application, the instance should be indistinguishable from one that has only been processing events.
 * Only the aggregate implementation is responsible for applying snapshots to itself. The framework does not aid state restoration in any way, besides setting appropriate sequence counters.
 * @method
 * @public
 * @param {module:esdf/utils/AggregateSnapshot} snapshot The snapshot object to apply.
 * @throws {module:esdf/core/EventSourcedAggregate~AggregateTypeMismatch} if the instance's _aggregateType does not equal the aggregate type indicated in the snapshot.
 * @throws {module:esdf/core/EventSourcedAggregate~AggregateUsageError} if the instance does not support snapshot application or the passed object is not a valid snapshot.
 */
EventSourcedAggregate.prototype.applySnapshot = function applySnapshot(snapshot){
	if(AggregateSnapshot.isAggregateSnapshot(snapshot)){
		if(this.supportsSnapshotApplication()){
			if(snapshot.aggregateType === this._aggregateType){
				this._applySnapshot(snapshot);
				this._updateSequenceNumber(snapshot.lastSlotNumber);
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
 * @method
 * @public
 * @returns {boolean} whether a snapshot can be applied to this aggregate.
 */
EventSourcedAggregate.prototype.supportsSnapshotApplication = function supportsSnapshotApplication(){
	return (typeof(this._applySnapshot) === 'function');
};

/**
 * Check if the aggregate instance supports snapshot generation (i.e. whether it can supply the data for a snapshot object's payload).
 * Note that snapshot generation support alone is not enough to guarantee that a snapshot can be re-applied later.
 * Moreover, keep in mind that, although snapshot *application* is often done externally (for example, by the loader before event-based rehydration), only the aggregate itself manages snapshot *generation and saving*.
 * @method
 * @public
 * @returns {boolean} whether this aggregate can be asked to generate a snapshot of itself.
 */
EventSourcedAggregate.prototype.supportsSnapshotGeneration = function supportsSnapshotGeneration(){
	return (typeof(this._getSnapshotData) === 'function');
};

/**
 * Save all staged events to the Event Sink (assigned earlier manually from outside to the Aggregate's "_eventSink" property).
 * A snapshot save is automatically triggered (in the background) if the snapshotting strategy allows it.
 * @method
 * @public
 * @param {Object} metadata The data that should be saved to storage along with the commit object. Should contain serializable data - as a basic heuristic, if JSON can stringify it, it qualifies.
 * @returns {external:Promise} Promise/A-compliant promise object which supports then(). The promise is resolved when the commit is saved, and rejected if the saving fails for any reason (including optimistic concurrency).
 */
EventSourcedAggregate.prototype.commit = function commit(metadata){
	if(typeof(metadata) !== 'object' || metadata === null){
		metadata = {};
	}
	// In case of child prototypes, this will often be undefined - set it so that the programmer does not have to remember doing that in every child's constructor.
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
	// Construct the commit object...
	var commitObject = new Commit(this._stagedEvents, this._aggregateID, this._nextSequenceNumber, this._aggregateType, metadata);
	// ... and tell the sink to try saving it, reacting to the result:
	when(self._eventSink.sink(commitObject),
	function _commitSinkSucceeded(result){
		// Now that the commit is sunk, we can clear the event staging area - new events will end up in subsequent commits.
		self._stagedEvents = [];
		self._updateSequenceNumber(commitObject.sequenceSlot);
		//NOTE: The check/log emission below is a good candidate for refactoring into Aspect-Oriented Programming.
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
		// Sink failed - do nothing. An upper layer can either retry the sinking, or reload the aggregate and retry (in the latter case, the sequence number will probably get refreshed).
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
 * @method
 * @private
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

/**
 * Enrich staged events before emission. Modifies the event object passed to it. This is so that the programmer does not have to specify all data with every event construction - instead, some keys of the payload can be assigned via enriching.
 * This method does nothing by default - it is up to individual aggregate implementations based on this prototype to override this function. Using a "switch" statement based on eventType is recommended.
 * @method
 * @protected
 * @param {module:esdf/core/Event~Event} event The event to be enriched. New key-value pairs can be added to event.eventPayload.
 */
EventSourcedAggregate.prototype._enrichEvent = function _enrichEvent(event){
	// Do nothing, unless this function is overloaded.
};

module.exports.EventSourcedAggregate = EventSourcedAggregate;
