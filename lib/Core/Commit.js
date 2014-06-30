/**
 * @module esdf/core/Commit
 */
var Event = require('./Event.js');
var Errors = require('../Errors');

/**
 * Construct a new commit. A commit is an atomic group of events, handled in an all-or-nothing manner by an event sink. It is the basic unit of event storage in this framework.
 * @constructor
 * @param {module:esdf/core/Event.Event[]} events A list of events that the commit is composed of.
 * @param {String} sequenceID Character-based ID (typically a GUID) of the stream to which this commit belongs.
 * @param {Number} sequenceSlot The slot number this commit is meant to occupy within the sequence. Only one commit may take a particular slot.
 * @param {String} originType Type name of the stream's origin. For aggregates, this is the aggregateType. Mostly used for checking whether a stream belongs to a particular object being rehydrated.
 * @param {Object} metadata The additional information, in a map format, associated with this commit.
 */
function Commit(events, sequenceID, sequenceSlot, originType, metadata){
	if(!Array.isArray(events)){ throw new Error('events must be an array while constructing Commit'); }
	if(typeof(sequenceID) !== 'string'){ throw new Error('sequenceID is not a string while constructing Commit'); }
	if(!sequenceSlot){ throw new Error('sequenceSlot not a number, or zero, while constructing Commit'); }
	
	this.events = events;
	this.sequenceID = sequenceID;
	this.sequenceSlot = sequenceSlot;
	this.originType = originType;
	this.metadata = metadata ? metadata : {};
}

/**
 * Get the events contained within this commit. 
 * @method
 * @returns {module:esdf/core/Event~Event[]} An array containing all events within this commit, in the same order that they were staged in its source aggregate / added to the commit.
 */
Commit.prototype.getEvents = function getEvents(){
	return this.events.slice();
};

/**
 * Get the metadata assigned to the particular Commit.
 * @method
 * @returns {Object} A free-form metadata object, containing any keys and values.
 */
Commit.prototype.getMetadata = function getMetadata(){
	return this.metadata;
};

// eventMap: a key-value map of event name => event constructor pairs.
Commit.restore = function restore(dehydratedCommit, eventMap){
	var restoredEvents = dehydratedCommit.events.map(function restoreEvent(dehydratedEvent){
		var eventType = dehydratedEvent.type;
		var appropriateConstructor = eventMap[eventType];
		var payload = dehydratedEvent.payload;
		if(typeof(appropriateConstructor.restorePayload) === 'function'){
			payload = appropriateConstructor.restorePayload(payload);
		}
		
		var restoredEvent = new appropriateConstructor(payload);
		restoredEvent.ID = dehydratedEvent.ID;
		restoredEvent.timestamp = new Date(dehydratedEvent.timestamp);
		
		return restoredEvent;
	});
	return new Commit(restoredEvents, dehydratedCommit.sequenceID, dehydratedCommit.sequenceSlot, dehydratedCommit.originType, dehydratedCommit.metadata);
};

module.exports.Commit = Commit;