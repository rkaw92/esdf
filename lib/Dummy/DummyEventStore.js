/**
 * @module esdf/dummy/DummyEventStore
 */

var when = require('when');
var Context = require('../Util/Context');
var Exception = require('../Util/Exception');

function DummyEventStoreConcurrencyError(sequenceID, sequenceSlot){
	return new Exception(function(){
		this.name = 'DummyEventStoreConcurrencyError';
		this.message = 'A commit slot number collision has occured. Please reload the source stream and retry the operation with current data.';
		this.data = {
			sequenceID: sequenceID,
			sequenceSlot: sequenceSlot
		};
		this.concurrency = true;
	});
}

function DummyEventStore(initialSequences, faultInjector){
	if(!initialSequences){
		initialSequences = {};
	}
	this._sequences = initialSequences;
	this._faultInjector = faultInjector || function noFaults(){};
}

DummyEventStore.prototype.streamSequenceCommits = function streamSequenceCommits(sequenceID, since, commitCallback){
	return when.try(this._faultInjector.bind(this), 'streamSequenceCommits', sequenceID, since, commitCallback).then((function(){
		return when.promise((function retrieveDummyStreamContents(resolve, reject){
			// If there is no sequence under this ID, pretend we have one that is empty, instead.
			var sequence = (this._sequences[sequenceID] || []).slice(since - 1);
			var commitCount = sequence.length;
			
			function processCommit(index){
				if(index === commitCount){
					resolve();
					return;
				}
				var commit = sequence[index];
				when.try(commitCallback, commit).done(processCommit.bind(undefined, index + 1), reject);
			}
			processCommit(0);
		}).bind(this));
	}).bind(this));
};

DummyEventStore.prototype.countSequenceCommits = function countSequenceCommits(sequenceID){
	return (this._sequences[sequenceID]) ? this._sequences[sequenceID].length : 0;
};

DummyEventStore.prototype.saveCommit = function saveCommit(commit){
	var sequenceID = commit.sequenceID;
	var sequenceSlot = commit.sequenceSlot;
	if(!this._sequences[sequenceID]){
		this._sequences[sequenceID] = [];
	}
	var sequence = this._sequences[sequenceID];
	// Apply the fault injector first:
	return when.try(this._faultInjector.bind(this), 'saveCommit', commit).then(function(){
		// No faults have been injected. Proceed as usual.
		// Check for a slot collision:
		if(sequenceSlot <= sequence.length){
			throw new DummyEventStoreConcurrencyError(commit.sequenceID, commit.sequenceSlot);
		}
		sequence.push(commit);
		return when.resolve();
	});
};

module.exports.DummyEventStore = DummyEventStore;