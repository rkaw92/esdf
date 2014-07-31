/**
 * @module esdf/core/Commit
 */
var Event = require('./Event.js');

/**
 * Construct a new commit. A commit is an atomic group of events, handled in an all-or-nothing manner by an event sink. It is the basic unit of event storage in this framework.
 * @constructor
 * @param {module:esdf/core/Event.Event[]} events A list of events that the commit is composed of.
 * @param {String} sequenceID Character-based ID (typically a GUID) of the stream to which this commit belongs.
 * @param {Number} sequenceSlot The slot number this commit is meant to occupy within the sequence. Only one commit may take a particular slot.
 * @param {String} aggregateType Name of the aggregate type, as reported by the proper EventSourcedAggregate.
 * @param {Object} metadata The additional information, in a map format, associated with this commit.
 */
function Commit(events, sequenceID, sequenceSlot, aggregateType, metadata){
	if(!Array.isArray(events)){ throw new Error('events must be an array while constructing Commit'); }
	if(typeof(sequenceID) !== 'string'){ throw new Error('sequenceID is not a string while constructing Commit'); }
	if(!sequenceSlot){ throw new Error('sequenceSlot not a number, or zero, while constructing Commit'); }
	
	this.events = events;
	this.sequenceID = sequenceID;
	this.sequenceSlot = sequenceSlot;
	this.aggregateType = aggregateType;
	this.metadata = metadata ? metadata : {};
}

/**
 * Get the events contained within this commit. 
 * @method
 * @returns {module:esdf/core/Event~Event[]} An array containing all events within this commit, in the same order that they were staged in its source aggregate / added to the commit.
 */
Commit.prototype.getEvents = function getEvents(){
	return this.events;
};

/**
 * Get the metadata assigned to the particular Commit.
 * @method
 * @returns {Object} A free-form metadata object, containing any keys and values.
 */
Commit.prototype.getMetadata = function getMetadata(){
	return this.metadata;
};

/**
 * Obtain a shallow copy of the Commit object, without the events. Note that the metadata object is shared between the instances.
 * @method
 * @returns {module:esdf/core/Commit~Commit} A Commit object with the event array emptied.
 */
Commit.prototype.getBare = function getBare(){
	return new Commit([], this.sequenceID, this.sequenceSlot, this.aggregateType, this.metadata)
};

/**
 * Convert a commit into a string form. Useful mainly when commits are saved or transmitted as strings, for example in simple key-value stores (Redis) or in string-based messaging systems (AMQP).
 *  This uses JSON for encoding the commit object - the format can be relied upon (if a specific implementation wishes to use, for example, ProtocolBuffers, then it should not use toString() and do the conversion on its own).
 * @returns {string} the commit encoded into a string, suitable for passing into the static {@link module:esdf/core/Commit~Commit.fromString} method.
 */
Commit.prototype.toString = function toString(){
	return JSON.stringify(this);
};

/**
 * Initialize and return a commit based on its "flattened" form (i.e. a plain Object with its methods and prototype information stripped).
 * @method
 * @static
 * @param {Object} flattenedCommit An object that has fields ['events', 'sequenceID', 'sequenceSlot', 'aggregateType', 'metadata'] and is not necessarily a Commit instance.
 * @returns {module:esdf/core/Commit~Commit} A Commit instance with the fields initialized by values from the passed object's fields.
 */
Commit.reconstruct = function reconstruct(flattenedCommit){
	//TODO: deep copy the event array and metadata.
	return new Commit(flattenedCommit.events, flattenedCommit.sequenceID, flattenedCommit.sequenceSlot, flattenedCommit.aggregateType, flattenedCommit.metadata);
};

module.exports.Commit = Commit;