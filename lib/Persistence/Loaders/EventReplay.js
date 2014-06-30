/**
 * @module esdf/persistence/loaders/EventReplay
 */

var when = require('when');
var Errors = require('../../Errors');
var Commit = require('../../Core/Commit').Commit;

function EventReplay(eventStore){
	if(!eventStore || typeof(eventStore.streamSequenceCommits) !== 'function'){
		throw new Errors.EventStoreRequiredError('EventReplay');
	}
	this._eventStore = eventStore;
}

EventReplay.prototype.rehydrateAggregate = function rehydrateAggregate(aggregateInstance){
	function processSingleCommit(dehydratedCommit){
		var restoredCommit = Commit.restore(dehydratedCommit, Object.getPrototypeOf(aggregateInstance).events);
		aggregateInstance.applyCommit(restoredCommit);
	}
	
	// Call the streamSequenceCommits method of our event store in a safe way via when.js. This basically converts untrusted promises and thrown exceptions alike into trusted promises.
	// We only request commits since the next sequence number (inclusive) - since all previous ones must already be there.
	return when.try(this._eventStore.streamSequenceCommits.bind(this._eventStore), aggregateInstance.getAggregateID(), aggregateInstance.getNextSequenceNumber(), processSingleCommit).then(function yieldAggregate(){
		return aggregateInstance;
	});
};

module.exports.EventReplay = EventReplay;