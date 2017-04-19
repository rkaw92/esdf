/**
 * @module esdf/core/EventSourcedAggregate
 */

'use strict';

const when = require('when');
const uuid = require('uuid');
const util = require('util');

const Commit = require('./Commit');
const { AggregateTypeMismatch, AggregateEventHandlerMissingError, AggregateUsageError } = require('../errors/EventSourcedAggregateErrors');
const AggregateSnapshot = require('../types/AggregateSnapshot');
const SnapshotStrategy = require('../strategies/SnapshotStrategy');

/**
 * Basic class for creating an in-memory object representation of an Aggregate Root. Aggregate Roots are basic business objects in the domain and the primary source of events.
 * An aggregate should typically listen to its own events (define on\* event handlers) and react by issuing such state changes, since it is the only keeper of its own internal state.
 * You __are__ supposed to extend this class to define your own entity classes.
 * @class
 */
class EventSourcedAggregate {
	constructor() {
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
	}

	/**
	 * Get a string describing the Aggregate Root's type. This is normally the class name,
	 *  unless it it is set separately for a given instance using _aggregateType.
	 * @method
	 * @public
	 */
	getAggregateType() {
		// First, consider the custom-set value:
		if (this._aggregateType) {
			return this._aggregateType;
		}
		// If no custom override is in place, try to determine the class name from the constructor:
		const myConstructor = this.constructor;
		if (!myConstructor) {
			throw new Error('No _aggregateProperty and no constructor reference found in the aggregate - can not determine its type');
		}
	}

	/**
	 * Set the Aggregate ID of the instance. Used when saving commits, to mark as belonging to a particular entity.
	 * @method
	 * @public
	 * @param {string} aggregateID The identity (aggregate ID) to assume when committing.
	 */
	setAggregateID(aggregateID) {
		this._aggregateID = aggregateID;
	}

	/**
	 * Get the Aggregate ID used when committing.
	 * @method
	 * @public
	 * @returns {string}
	 */
	getAggregateID() {
		return this._aggregateID;
	}

	/**
	 * Get the sequence number that will be used when saving the next commit. For a cleanly-initialized aggregate, this equals 1.
	 * @method
	 * @public
	 * @returns {number}
	 */
	getNextSequenceNumber() {
		return this._nextSequenceNumber || 1;
	}

	/**
	 * Get an array of all staged events which are awaiting commit, in the same order they were staged.
	 * @method
	 * @public
	 * @returns {module:esdf/core/Event~Event[]}
	 */
	getStagedEvents() {
		return this._stagedEvents;
	}

	_clearStagedEvents() {
		this._stagedEvents = [];
	}

	/**
	 * Apply the given commit to the aggregate, causing it to apply each event, individually, one after another.
	 * @method
	 * @public
	 * @param {module:esdf/core/Commit~Commit} commit The commit object to apply.
	 * @throws {module:esdf/core/EventSourcedAggregate~AggregateTypeMismatch} if the instance's _aggregateType does not equal the commit's saved aggregateType.
	 * @throws {module:esdf/core/EventSourcedAggregate~AggregateEventHandlerMissingError} if the handler for at least one of the commit's events is missing (and _allowMissingEventHandlers is false).
	 */
	applyCommit(commit) {
		const self = this;
		// Check if the commit's saved aggregateType matches our own. If not, bail out - this is not our commit for sure!
		if (this._aggregateType !== commit.aggregateType) {
			throw new AggregateTypeMismatch(this._aggregateType, commit.aggregateType);
		}
		commit.events.forEach(function(event) {
			// The handler only gets the event and the commit metadata. It is not guaranteed to have access to other commit members.
			self._applyEvent(event, commit);
		});
		// Increment our internal sequence number counter.
		this._updateSequenceNumber(commit.sequenceSlot);
	}

	/**
	 * Apply the event to the Aggregate by calling the appropriate registered event handlers.
	 * @method
	 * @private
	 * @param {module:esdf/core/Event~Event} event The event to apply.
	 * @throws {module:esdf/core/EventSourcedAggregate~AggregateEventHandlerMissingError} if the handler for the passed event (based on event type) is missing.
	 */
	//TODO: Document the "on*" handler function contract.
	_applyEvent(event) {
		const handlerFunctionName = 'on' + event.eventType;
		if (typeof(this[handlerFunctionName]) === 'function') {
			this[handlerFunctionName](event);
		}
		else{
			if (!this._allowMissingEventHandlers) {
				throw new AggregateEventHandlerMissingError('Event type ' + event.eventType + ' applied, but no handler was available - bailing out to avoid programmer error!');
			}
		}
	}

	/**
	 * Conditionally increase the internal next sequence number if the passed argument is greater or equal to it. Sets the next sequence number to the last commit number + 1.
	 * @method
	 * @private
	 * @param {number} lastCommitNumber The number of the processed commit.
	 */
	_updateSequenceNumber(lastCommitNumber) {
		if (typeof(this._nextSequenceNumber) !== 'number') {
			this._nextSequenceNumber = 1;
		}
		if (Number(lastCommitNumber) >= this._nextSequenceNumber) {
			this._nextSequenceNumber = Number(lastCommitNumber) + 1;
		}
	}

	advanceState(commit) {
		this._clearStagedEvents();
		this._updateSequenceNumber(commit.sequenceSlot);
	}

	/**
	 * Apply the event to the Aggregate from an outside source (i.e. non-intrinsic).
	 * @method
	 * @public
	 * @param {module:esdf/core/Event~Event} event The event to apply.
	 * @param {?module:esdf/core/Commit~Commit} commit The commit that the event is part of. If provided, the internal next slot number counter is increased to the commit's slot + 1.
	 */
	applyEvent(event, commit) {
		this._applyEvent(event);
		if (commit && typeof(commit.sequenceSlot) === 'number') {
			this._updateSequenceNumber(commit.sequenceSlot);
		}
	}

	/**
	 * Stage an event for committing later. Immediately applies the event to the Aggregate (via the built-in EventEmitter), so rolling back is not possible
	 *  (reloading the Aggregate from the Event Sink and retrying can be used instead, see utils.tryWith).
	 * @method
	 * @private
	 * @param {module:esdf/core/Event~Event} event The event to be enqueued for committing later.
	 */
	_stageEvent(event) {
		// If this is the first call, we need to initialize the pending event array.
		//  It can not be done via prototypes, because that would mean the array is shared among all instances (a big problem!).
		if (!this._stagedEvents) {
			this._stagedEvents = [];
		}
		// Enrich the event using the aggregate's specific enrichment function.
		this._enrichEvent(event);
		this._stagedEvents.push(event);
		this._applyEvent(event);
		return true;
	}

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
	applySnapshot(snapshot) {
		if (AggregateSnapshot.isAggregateSnapshot(snapshot)) {
			if (this.supportsSnapshotApplication()) {
				if (snapshot.aggregateType === this._aggregateType) {
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
	}

	/**
	 * Check if the aggregate instance supports snapshot application.
	 * Note that a passed check does not guarantee support for saving snapshots - only re-applying them on top of an instance.
	 * @method
	 * @public
	 * @returns {boolean} whether a snapshot can be applied to this aggregate.
	 */
	supportsSnapshotApplication() {
		return (typeof(this._applySnapshot) === 'function');
	}

	/**
	 * Check if the aggregate instance supports snapshot generation (i.e. whether it can supply the data for a snapshot object's payload).
	 * Note that snapshot generation support alone is not enough to guarantee that a snapshot can be re-applied later.
	 * Moreover, keep in mind that, although snapshot *application* is often done externally (for example, by the loader before event-based rehydration), only the aggregate itself manages snapshot *generation and saving*.
	 * @method
	 * @public
	 * @returns {boolean} whether this aggregate can be asked to generate a snapshot of itself.
	 */
	supportsSnapshotGeneration() {
		return (typeof(this._getSnapshotData) === 'function');
	}

	/**
	 * Get a Commit object containing all staged events.
	 * Such an object is suitable for saving in a database as an atomic transaction.
	 * @method
	 * @public
	 * @param {Object} metadata - The metadata to assign to the constructed Commit.
	 * @returns {module:esdf/core/Commit~Commit}
	 */
	getCommit(metadata) {
		return new Commit((this._stagedEvents || []).slice(), this._aggregateID, this._nextSequenceNumber || 1, this._aggregateType, metadata);
	}


	/**
	 * Save all staged events to the Event Sink (assigned earlier manually from outside to the Aggregate's "_eventSink" property).
	 * A snapshot save is automatically triggered (in the background) if the snapshotting strategy allows it.
	 * @method
	 * @public
	 * @param {Object} metadata The data that should be saved to storage along with the commit object. Should contain serializable data - as a basic heuristic, if JSON can stringify it, it qualifies.
	 * @returns {external:Promise} Promise/A-compliant promise object which supports then(). The promise is resolved when the commit is saved, and rejected if the saving fails for any reason (including optimistic concurrency).
	 */
	commit(metadata) {
		//TODO: Get rid of commit().
		if (typeof(metadata) !== 'object' || metadata === null) {
			metadata = {};
		}
		// In case of child prototypes, this will often be undefined - set it so that the programmer does not have to remember doing that in every child's constructor.
		if (typeof(this._nextSequenceNumber) !== 'number') {
			this._nextSequenceNumber = 1;
		}
		const self = this;
		const emitDeferred = when.defer(); //emission promise - to be resolved when the event batch is saved in the database
		// Try to sink the commit. If empty, return success immediately.
		if (!this._stagedEvents) {
			this._stagedEvents = [];
		}
		if (this._stagedEvents.length === 0) {
			return emitDeferred.resolver.resolve();
		}
		// Construct the commit object. We use slice() to make a point-in-time snapshot of the array's structure, so that further pushes/removals do not affect it.
		const commitObject = this.getCommit(metadata);
		// ... and tell the sink to try saving it, reacting to the result:
		when(self._eventSink.sink(commitObject),
		function _commitSinkSucceeded(result) {
			// Now that the commit is sunk, we can clear the event staging area - new events will end up in subsequent commits.
			self._stagedEvents = [];
			self._updateSequenceNumber(commitObject.sequenceSlot);
			// Now that the commit has been saved, we proceed to save a snapshot if the snapshotting strategy tells us to (and we have a snapshot save provider).
			//  Note that _snapshotStrategy is called with "this" set to the current aggregate, which makes it behave like a private method.
			if (self.supportsSnapshotGeneration() && self._snapshotter && self._snapshotStrategy && self._snapshotStrategy(commitObject)) {
				self._saveSnapshot();
				// Since saving a snapshot is never mandatory for correct operation of an event-sourced application, we do not have to react to errors.
			}
			return emitDeferred.resolver.resolve(result);
		},
		function _commitSinkFailed(reason) {
			// Sink failed - do nothing. An upper layer can either retry the sinking, or reload the aggregate and retry (in the latter case, the sequence number will probably get refreshed).
			return emitDeferred.resolver.reject(reason);
		}); //This is a promise (thenable), so return its consumer-facing part.
		return emitDeferred.promise;
	}

	/**
	 * Enrich staged events before emission. Modifies the event object passed to it. This is so that the programmer does not have to specify all data with every event construction - instead, some keys of the payload can be assigned via enriching.
	 * This method does nothing by default - it is up to individual aggregate implementations based on this prototype to override this function. Using a "switch" statement based on eventType is recommended.
	 * @method
	 * @protected
	 * @param {module:esdf/core/Event~Event} event The event to be enriched. New key-value pairs can be added to event.eventPayload.
	 */
	_enrichEvent(event) {
		// Do nothing, unless this function is overloaded.
	}
}

module.exports = EventSourcedAggregate;
