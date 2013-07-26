/**
 * @module esdf/core/Event
 */

var uuid = require('uuid');

/**
 * Construct a new Event instance. Events are the basic (and only!) carrier of the application's state changes, and thus, of system state.
 * @constructor
 * @param {String} eventType The event type. This is a textual representation of the kind of event that has occured.
 * @param {Object} eventPayload The data about the event that took place. Most events need some attributes to specify exactly what happened. This is usually a derivative of some action's input parameters.
 * @param {Object} [metadata] Additional key-value pairs, separated from the payload in application processing logic. Usually contains, among others, the actual command parameters that were used to generate this event, for tracing purposes.
 * @param {String} [aggregateID] ID of the originating Aggregate. This is typically omitted when originally creating the event - by default, Aggregates will overwrite this ID in _stageEvent automatically.
 * @param {String} [eventID] The event ID to initialize the event with. Useful when reconstructing events from serialized storage (e.g. a DB).
 */
function Event(eventType, eventPayload, metadata, aggregateID, eventID){
	this.eventType = eventType;
	this.eventPayload = eventPayload;
	this.aggregateID = (typeof(aggregateID) !== 'undefined') ? aggregateID : undefined;
	this.metadata = metadata ? metadata : {};
	this.eventID = (typeof(eventID) !== 'undefined') ? eventID : uuid.v4();
	//TODO: methods
}

/**
 * Rebuild an event from its flattened object form (i.e. from an object that has been serialized and/or had its methods stripped).
 * @param {Object} flattenedEvent The object to reconstruct from. Will take its properties and construct a new Event based on them.
 * @returns {Event}
 */
Event.reconstruct = function reconstruct(flattenedEvent){
	return new Event(flattenedEvent.eventType, flattenedEvent.eventPayload, flattenedEvent.metadata);
};

module.exports.Event = Event;