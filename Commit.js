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

Commit.prototype.getEvents = function getEvents(){
	return this.events;
};

Commit.prototype.getMetadata = function getMetadata(){
	return this.metadata;
};

//TODO: consider adding a standard serialize implementation
/**
 * Initialize a commit based on its flattened form (i.e. a plain Object with its methods and prototype information stripped).
 * @static
 */
Commit.reconstruct = function reconstruct(flattenedCommit){
	//TODO: reconstruct events, too!
	return new Commit(flattenedCommit.events, flattenedCommit.sequenceID, flattenedCommit.sequenceSlot, flattenedCommit.aggregateType, flattenedCommit.metadata);
};

module.exports.Commit = Commit;