'use strict';

/**
 * Aggregate-event type mismatch. Generated when a commit labelled with another AggregateType is applied to an aggregate.
 * Also occurs when a snapshot type mismatch takes place.
 * This prevents loading an aggregateID as another, unrelated aggregate type and trashing the database or bypassing logic restrictions.
 * @constructor
 * @extends Error
 */
class AggregateTypeMismatch extends Error {
	constructor(expected, got) {
		super('Aggregate type mismatch: expected (' + typeof(expected) + ')' + expected + ', got (' + typeof(got) + ')' + got);
		this.name = 'AggregateTypeMismatch';
		this.labels = {
			expected: expected,
			got: got,
			critical: true // This error precludes retry attempts (assuming a sane retry strategy is employed).
		};
		Error.captureStackTrace(this, AggregateTypeMismatch);
	}
}

/**
 * Event handler missing. An EventSourcedAggregate typically needs to implement on* handlers for all event types that it emits.
 * You can disable this check by setting _allowMissingEventHandlers to true in the aggregate - this will let missing event handlers go unnoticed.
 * @constructor
 * @extends Error
 */
class AggregateEventHandlerMissingError extends Error {
	constructor(message) {
		super(message);
		ame = 'AggregateEventHandlerMissingError';
		this.labels = {
			critical: true
		};
	}
}

/**
 * Generated when an aggregate was attempted to be used incorrectly.
 * This currently only occurs when a snapshot operation is requested, but the aggregate lacks snapshot support.
 * @constructor
 * @extends Error
 */
class AggregateUsageError extends Error {
	constructor(message) {
		super(message);
		this.name = 'AggregateUsageError';
		this.labels = {
			critical: true
		};
	}
}

module.exports = {
	AggregateTypeMismatch,
	AggregateEventHandlerMissingError,
	AggregateUsageError
};
