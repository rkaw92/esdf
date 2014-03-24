/**
 * @module esdf/interfaces/EventSinkInterface
 */

/**
 * An EventSink is the component responsible for saving {@link module:esdf/core/Event|Events} (grouped under {@link module:esdf/core/Commit|Commit objects}) and rehydrating {@link module:esdf/core/EventSourcedAggregate|Aggregates} with them.
 *  Thus, it provides the basic storage facility for domain events in an event-sourced application.
 * @name module:esdf/interfaces/EventSinkInterface~EventSinkInterface
 * @class
 * @interface
 * @abstract
 */

/**
 * Attempts to save a commit (containing an array of events) into the Event Store. Returns a promise which resolves upon a successful save and is rejected on any error (with the error being the rejection reason, unaltered).
 *  Commits are saved atomically in an all-or-nothing fashion by all supported event sinks, independently from other commits.
 *  Although the promise's resolution guarantees that the commit has been saved as a whole, the specification does not impose any persistence constraints.
 *  Check your particular Event Store implementation as to what persistence guarantees are provided.
 * @function
 * @abstract
 * @name module:esdf/interfaces/EventSinkInterface~EventSinkInterface#sink
 * @param {module:esdf/core/Commit~Commit} commit The commit object to save to the database atomically.
 * @returns {external:Promise} A Promise/A compliant object. Resolves when the commit sink is complete, rejects if there is a concurrency exception or any other type of error.
 */

/**
 * Apply all the events from a given stream ID to the passed aggregate object.
 * @function
 * @abstract
 * @name module:esdf/interfaces/EventSinkInterface~EventSinkInterface#rehydrate
 * @param {module:esdf/core/EventSourcedAggregate~EventSourcedAggregate} object The aggregate object to apply the events to.
 * @param {string} stream_id The stream ID from which to load the events. This is equivalent to the Aggregate ID of an object that you wish to load.
 * @param {number} since The commit slot number to start the rehydration from (inclusive). Mainly used when the aggregate already has had some state applied, for example after loading a snapshot.
 * @returns {external:Promise} A Promise/A compliant object. Resolves when all known commits (since the one provided in parameters) have been applied. Rejects with an error from the infrastructure or from the aggregate if rehydration fails.
 */