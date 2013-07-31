/**
 * @module esdf/core/Commit
 */
var Event = require('./Event.js');

/**
 * Construct a new commit. A commit is an atomic group of events, handled in an all-or-nothing manner by the infrastructure.
 * @constructor
 * @param {module:esdf/core/Event.Event[]} events A list of events that the commit is composed of.
 * @param {String} sequenceID Character-based ID (typically a GUID) of the stream to which this commit belongs.
 * @param {Number} sequenceSlot The slot number this commit is meant to occupy within the sequence. Only one commit may take a particular slot.
 */
function Commit(events, sequenceID, sequenceSlot, metadata){
	if(!Array.isArray(events)){
		throw new Error('events must be an array while constructing Commit');
	}
	if(typeof(sequenceID) !== 'string'){
		if(typeof(sequenceID) === 'number'){
			sequenceID = sequenceID + '';
		}
		else{
			throw new Error('sequenceID is not a string while constructing Commit');
		}
	}
	if(!sequenceSlot){
		throw new Error('sequenceSlot not a number, or zero, while constructing Commit');
	}
	this.events = events;
	this.sequenceID = sequenceID;
	this.sequenceSlot = sequenceSlot;
	this.metadata = metadata ? metadata : {};
}

Commit.prototype.getEvents = function getEvents(){
	return this.events;
};

Commit.prototype.getMetadata = function getMetadata(){
	return this.metadata;
};

/**
 * Initialize a commit based on its flattened form (i.e. a plain Object with its methods and prototype information stripped).
 * @static
 */
Commit.reconstruct = function reconstruct(flattenedCommit){
	return new Commit(flattenedCommit.events, flattenedCommit.sequenceID, flattenedCommit.sequenceSlot, flattenedCommit.metadata);
};

module.exports.Commit = Commit;