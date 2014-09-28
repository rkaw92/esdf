var when = require('when');
var Errors = require('../../Errors');
var Commit = require('../Commit/');

/**
 * A CommitSaver is an object persistor which uses Event Sourcing to capture application state changes from a single object. To this end, all events since loading (as presented to the saver by the object) are gathered into a single Commit and saved in a unit of work (atomically).
 * @constructor
 * @implements {IObjectPersistor}
 * @param {IEventStore} The Event Store into which Commits should be saved.
 */
function CommitSaver(eventStore){
	if(!eventStore || typeof(eventStore.saveSequenceCommit) !== 'function'){
		throw new Errors.InterfaceError('saveSequenceCommit');
	}
	this._eventStore = eventStore;
}

/**
 * Gather the events (changes) from an object and save to the Event Store using the object's ID as the event sequence ID.
 * @param {ICommitSequenceProducer} changedObject The object to persist.
 */
CommitSaver.prototype.persistObject = function persistObject(changedObject){
	var saveSequenceCommit = this._eventStore.saveSequenceCommit.bind(this._eventStore);
	
	var events = changedObject.getPendingEvents().slice();
	var changesCommit = new Commit(events, changedObject.getSequenceID(), changedObject.getSequenceType());
	return when.try(saveCommit, changesCommit).yield(changedObject);
};

module.exports.CommitSaver = CommitSaver;