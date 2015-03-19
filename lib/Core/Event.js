/**
 * @module esdf/core/Event
 */

/**
 * Construct a new Event instance. Events are the basic (and only!) carrier of the application's state changes, and thus, of system state.
 * All Events are Domain Events - that is, they span the entire domain and all members of it may consume them (presumably via an Event Bus).
 * @constructor
 * @abstract
 * @param {Object} payload The data to be contained in this event.
 */
function Event(type, payload){
	/**
	 * Type name of this event. This should be used to tell different kinds of Domain Events (i.e. different business occurences) from one another.
	 * @type {string}
	 */
	this.type = type;
	/**
	 * System-wide, unique identifier of this event. Usually a UUID, GUID, or CUID.
	 * @type {string}
	 */
	this.ID = null;
	/**
	 * The data contained in the event. Only this data may be used by consumers (including Event Sourced Aggregates themselves).
	 * Note that all members of the payload are "public" - that is, if an event source (aggregate?) needs to apply state changes to itself,
	 * it must also expose all data used to perform these changes in the event.
	 * @type {Object}
	 */
	this.payload = payload;
	/**
	 * Time when the event has been generated. Populated at event object construction time, not when persisting the object.
	 * @type {Date}
	 */
	this.timestamp = new Date();
}

/**
 * Encode the event into a string.
 *  This uses JSON, similarly to Commit.
 * @returns {string} The encoded form of the Event, suitable for recovery via static method Event.fromString.
 */
Event.prototype.toString = function toString(){
	return JSON.stringify(this);
};

/**
 * Recover an Event object from a serialized form.
 * @param {string} input The input data from which to recover the Event. Should correspond to the value returned by Event.prototype.toString.
 * @returns {module:esdf/core/Event~Event}
 */
Event.fromString = function fromString(input){
	var bareObject = JSON.parse(input);
	var eventObject = new Event(bareObject.type, bareObject.payload);
	eventObject.ID = bareObject.ID;
	eventObject.timestamp = new Date(bareObject.timestamp);
	return eventObject;
};

module.exports.Event = Event;