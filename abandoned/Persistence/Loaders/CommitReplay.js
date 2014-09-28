var when = require('when');
var Errors = require('../../Errors');
var Commit = require('../../Core/Commit').Commit;

/**
 * CommitReplay is a loader which loads and re-applies commits (batches of events) onto an object.
 * @constructor
 * @implements {IObject}
 * @param {IEventStore}
 */
function CommitReplay(eventStore){
	if(!eventStore || typeof(eventStore.streamSequenceCommits) !== 'function'){
		throw new Errors.InterfaceError('streamSequenceCommits');
	}
	this._eventStore = eventStore;
}

/**
 * 
 */
CommitReplay.prototype.rehydrateObject = function rehydrateObject(instance){
	function processSingleCommit(dehydratedCommit){
		var restoredCommit = Commit.restore(dehydratedCommit, Object.getPrototypeOf(instance).events);
		instance.applyCommit(restoredCommit);
	}
	
	// Call the streamSequenceCommits method of our event store in a safe way via when.js. This basically converts untrusted promises and thrown exceptions alike into trusted promises.
	// We only request commits since the next sequence number (inclusive), because all previous ones, indicated by the number, must already be there.
	var streamSequenceCommits = this._eventStore.streamSequenceCommits.bind(this._eventStore);
	return when.try(streamSequenceCommits, instance.getSequenceID(), instance.getNextSequenceNumber(), processSingleCommit).yield(instance);
};

module.exports.CommitReplay = CommitReplay;