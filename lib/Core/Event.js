/**
 * @module esdf/core/Event
 */

/**
 * Construct a new Event instance. Events are the basic (and only!) carrier of the application's state changes, and thus, of system state.
 * @constructor
 * @abstract
 * @param {Object} payload The data to be contained in this event.
 */
function Event(payload){
	/**
	 * Type name of this event.
	 * @type {string}
	 */
	this.type = null;
	/**
	 * System-wide, unique identifier of this event.
	 * @type {string}
	 */
	this.ID = null;
	/**
	 * The data contained in the event.
	 * @type {Object}
	 */
	this.payload = payload;
	/**
	 * Time of generation.
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

module.exports.Event = Event;