var TransformStream = require('stream').Transform;
var Commit = require('../core/Commit');
var Event = require('../core/Event');

function CommitAssembler() {
	this._pendingEvents = [];
	this._lastCommitData = null;
	TransformStream.call(this, { objectMode: true });
}
CommitAssembler.prototype = Object.create(TransformStream.prototype);

CommitAssembler.prototype._transform = function _transform(eventCommitObject, encoding, callback) {
	var last = this._lastCommitData;
	// If there was a previous commit and it was for a different slot, this means we have got a new commit.
	// Thus, we should pack the pending events into a commit.
	var assembledCommit;
	if (last && (last.sequenceID !== eventCommitObject.sequenceID || last.sequenceSlot !== eventCommitObject.sequenceSlot)) {
		assembledCommit = new Commit(this._pendingEvents, last.sequenceID, last.sequenceSlot, last.aggregateType, last.metadata);
		this.push(assembledCommit);
	}
	// Unconditionally add the current event to our pending list:
	var newEvent = new Event(eventCommitObject.eventType, eventCommitObject.eventPayload, eventCommitObject.eventID);
	this._pendingEvents.push(newEvent);
	this._lastCommitData = eventCommitObject;
	callback();
};

CommitAssembler.prototype._flush = function _flush(callback) {
	// If there ever was any data, terminate the current commit. Otherwise, we should not be producing empty commits for no reason.
	var last = this._lastCommitData;
	var assembledCommit;
	if (last) {
		assembledCommit = new Commit(this._pendingEvents, last.sequenceID, last.sequenceSlot, last.aggregateType, last.metadata);
		this.push(assembledCommit);
	}
	callback();
};

module.exports = CommitAssembler;
