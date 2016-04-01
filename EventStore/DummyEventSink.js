/**
 * @module esdf/test/DummyEventSink
 */

var when = require('when');
var EventEmitter = require('events').EventEmitter;
var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;
var CommitStream = require('../types/CommitStream').CommitStream;

/**
 * Create a dummy Event Sink. The Event Sink can fully simulate sinking and rehydration, and stays in compliance with Promises/A.
 * 
 * @constructor
 */
function DummyEventSink(){
	/**
	 * Whether the next sink() attempt should succeed.
	 * @public
	 * @type {boolean}
	 */
	this._wantSinkSuccess = true;
	/**
	 * Whether the next rehydration attempt should succeed.
	 * @public
	 * @type {boolean}
	 */
	this._wantRehydrateSuccess = true;
	/**
	 * The type of failure to enrich the error with when a failure is requested via _wantSinkSuccess=false.
	 * @public
	 * @type {string}
	 */
	this._failureType = 'DummyEventSink test failure';
	/**
	 * The labels to be applied to the simulated errors.
	 * @public
	 * @type {Object}
	 */
	this._failureLabels = {};
	/**
	 * The event streams holding the sunk data.
	 * @private
	 * @type {Object.<string, module:esdf/core/Commit[]>}
	 */
	this._streams = {};
	/**
	 * A list of queues that newly-sinked events shall be pushed onto.
	 * @private
	 * @type {module:esdf/utils/QueueProcessor.QueueProcessor[]}
	 */
	this._dispatchQueues = [];
}

/**
 * Attempts to save a commit (array of event objects) into the Event Store. Returns a promise which resolves upon a successful save and is rejected on any error (with the error being the rejection reason verbatim).
 * Since this is only a dummy Event Sink, all events are only saved into a temporary object, and are discarded when the DummyEventSink is destroyed.
 * All commits are, in addition to being loadable, also dispatched to the local eventSource.
 * 
 * @param {module:esdf/core/Commit~Commit}
 * @returns {external:Promise} A Promise/A compliant object. Resolves when the commit sink is complete, rejects if there is a concurrency exception or any other type of error.
 */
DummyEventSink.prototype.sink = function sink(commit){
	return when.promise((function(resolve, reject){
		var sinkError = new Error('DummyEventSink.sink:reject');
		sinkError.type = this._failureType;
		sinkError.labels = this._failureLabels;
		if(this._wantSinkSuccess){
			var self = this;
			// Case 1: No commits in this sequence yet.
			if(typeof(this._streams[commit.sequenceID]) === 'undefined'){
				this._streams[commit.sequenceID] = [commit];
			}
			else{
				// Case 2: Some commits already in this sequence, but no slot number conflict.
				if(this._streams[commit.sequenceID].length < commit.sequenceSlot){
					this._streams[commit.sequenceID].push(commit);
				}
				else{
					// Case 3: Slot number conflict.
					var concurrencyException = new Error('DummyEventSink.sink:OptimisticConcurrencyException(' + commit.sequenceSlot + ',' + this._streams[commit.sequenceID].length + ')');
					concurrencyException.labels = {
						isRetriable: true
					};
					return reject(concurrencyException);
				}
			}
			// Dispatch the event to the dummy queue.
			this._dispatch(commit);
			return resolve(true);
		}
		else{
			return reject(sinkError);
		}
	}).bind(this));
};

DummyEventSink.prototype.getCommitStream = function getCommitStream(sequenceID, since) {
	var self = this;
	var alreadyRead = false;
	
	return new CommitStream(function(sequenceID, sequenceSlot) {
		if (alreadyRead) {
			return when.resolve(null);
		}
		
		// Return all commits as a single batch. Performance is not too critical for the DummyEventSink, so we let the CommitStream take care of splitting the array into commits.
		alreadyRead = true;
		var chunk = (self._streams[sequenceID] || []).slice(since - 1);
		return when.resolve(chunk);
	}, sequenceID, since);
};

/**
 * Apply all the events from a given stream ID to the passed aggregate object.
 * 
 * @param {module:esdf/core/EventSourcedAggregate~EventSourcedAggregate} object The aggregate object to apply the events to.
 * @param {string} sequenceID The stream ID from which to load the events.
 * @param {number} since The commit slot number to start the rehydration from (inclusive). Mainly used when the aggregate already has had some state applied, for example after loading a snapshot.
 * @param {number} [diffSince] The commit slot number to compute the subsequent commits relative to. If passed, the resolution value of the returned rehydration promise will contain a list of commits since this slot number (non-inclusive) in the "diffCommits" property.
 * @returns {Promise.<Object>} A promise for a status/info object that fulfills when the aggregate has been fully rehydrated, or rejects when an error occurs during the loading or applying of the commits from the sequence.
 */
DummyEventSink.prototype.rehydrate = function rehydrate(object, sequenceID, since, diffSince) {
	if (isNaN(diffSince) || typeof(diffSince) !== 'number') {
		diffSince = Infinity;
	}
	
	return when.promise((function(resolve, reject) {
		var rehydrateError = new Error('DummyEventSink.rehydrate:RehydrationEventRetrievalDummyFailure');
		var sinceCommit = (typeof(since) === 'number') ? Math.floor(since) : 1;
		if(sinceCommit < 1){
			return reject(new Error('DummyEventSink.rehydrate:Can not start applying commits from commit slot number lesser than 1!'));
		}
		rehydrateError.type = this._failureType;
		
		if(this._wantRehydrateSuccess){
			var commitStream = this.getCommitStream(sequenceID, Math.min(sinceCommit, diffSince));
			
			// Prepare an array for the commits that have happened since diffSince.
			var diffCommits = [];
			
			commitStream.on('data', function(commit) {
				try {
					// Apply the commit to the aggregate instance if needed:
					object.applyCommit(commit);
					// If the commit is considered "new" (after diffSince), we will need to return it in the diff.
					if (commit.sequenceSlot > diffSince) {
						diffCommits.push(commit);
					}
				}
				catch (error) {
					reject(error);
				}
			});
			
			commitStream.on('end', function() {
				resolve({
					diffCommits: diffCommits
				});
			});
		}
		else{
			return reject(rehydrateError);
		}
	}).bind(this));
};

/**
 * Get a new dispatch queue. All new events sinked to this DummyEventSink shall be pushed onto the queue.
 * Note that *only* the DummyEventSink needs this because of its coupling to DummyEventSinkStreamer.
 * 
 * @returns {module:esdf/utils/QueueProcessor.QueueProcessor}
 */
DummyEventSink.prototype.getDispatchQueue = function getDispatchQueue(){
	var newDispatchQueue = new QueueProcessor();
	this._dispatchQueues.push(newDispatchQueue);
	return newDispatchQueue;
};

/**
 * Dispatch a commit to all queues. This is how consumers (streamers, most likely) get the events for publishing.
 * 
 * @private
 * @param {module:esdf/core/Commit~Commit} commit The commit to dispatch via the dispatch queues.
 */
DummyEventSink.prototype._dispatch = function _dispatch(commit){
	this._dispatchQueues.forEach(function(queue){
		queue.push(commit);
	});
};

module.exports.DummyEventSink = DummyEventSink;