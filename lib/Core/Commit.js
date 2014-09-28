var Event = require('./Event.js');
var Errors = require('../Errors');

/**
 * Construct a new commit. A commit is a batch of events persisted together in a Unit of Work (all-or-nothing semantics).
 * @constructor
 * @param {string} sequenceID ID of the commit stream that the commit shall belong to. Used by persistence layers to group entries.
 * @param {number} sequenceSlot The slot taken up in the sequence pointed at by sequenceID. Only one commit may occupy a given slot. This number is used for conflict detection in Optimistic Concurrency.
 * @param {Event[]} events A list of events to be contained within the batch.
 */
function Commit(sequenceID, sequenceSlot, events){
	this.sequenceID = sequenceID;
	this.sequenceSlot = sequenceSlot;
	this.events = events.slice();
}

/**
 * Get the events contained within this commit.
 * @method
 * @returns {Event[]} An array containing all events within this commit, in the same order that they were produced by the source.
 */
Commit.prototype.getEvents = function getEvents(){
	return this.events.slice();
};

module.exports.Commit = Commit;