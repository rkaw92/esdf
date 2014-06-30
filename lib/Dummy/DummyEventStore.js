/**
 * @module esdf/dummy/DummyEventStore
 */

var when = require('when');

function DummyEventStore(initialSequences, faultInjector){
	if(!initialSequences){
		initialSequences = {};
	}
	this._sequences = initialSequences;
	this._faultInjector = faultInjector;
}

DummyEventStore.prototype.streamSequenceCommits = function streamSequenceCommits(sequenceID, since, commitCallback){
	return when.promise((function retrieveDummyStreamContents(resolve, reject){
		// If there is no sequence under this ID, pretend we have one that is empty, instead.
		var sequence = this._sequences[sequenceID].slice(since - 1) || [];
		var commitCount = sequence.length;
		
		function processCommit(index){
			if(index === commitCount){
				resolve();
				return;
			}
			var commit = sequence[index];
			when.try(commitCallback, commit).done(processCommit.bind(undefined, index + 1));
		}
		processCommit(0);
	}).bind(this));
};

module.exports.DummyEventStore = DummyEventStore;