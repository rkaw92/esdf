/**
 * @module esdf/Test/DummyEventSink
 */

var when = require('when');
var EventEmitter = require('events').EventEmitter;
var QueueProcessor = require('../utils/QueueProcessor.js').QueueProcessor;

/**
 * Create a dummy Event Sink. The Event Sink can fully simulate sinking and rehydration, and stays in compliance with Promises/A.
 * 
 * @constructor
 */
function DummyEventSink(){
	/**
	 * Whether the next sink() attempt should succeed.
	 * @public
	 */
	this._wantSinkSuccess = true;
	/**
	 * Whether the next rehydration attempt should succeed.
	 * @public
	 */
	this._wantRehydrateSuccess = true;
	/**
	 * The type of failure to enrich the error with when a failure is requested via _wantSinkSuccess=false.
	 * @public
	 */
	this._failureType = 'DummyEventSink test failure';
	/**
	 * The event streams holding the sunk data.
	 * @private
	 */
	this._streams = {};
	/**
	 * The EventSource-like local emitter. Used by dispatchers to get commit data from.
	 * @public
	 */
	this.dispatchQueue = new QueueProcessor();
}

/**
 * Attempts to save a commit (array of event objects) into the Event Store. Returns a promise which resolves upon a successful save and is rejected on any error (with the error being the rejection reason verbatim).
 * Since this is only a dummy Event Sink, all events are only saved into a temporary object, and are discarded when the DummyEventSink is destroyed.
 * All commits are, in addition to being loadable, also dispatched to the local eventSource.
 * 
 * @param {module:esdf/core/Commit.Commit}
 * @returns {external:Promise} A Promise/A compliant object. Resolves when the commit sink is complete, rejects if there is a concurrency exception or any other type of error.
 */
DummyEventSink.prototype.sink = function sink(commit){
	var r = when.defer().resolver;
	var sinkError = new Error('DummyEventSink.sink:reject');
	sinkError.type = this._failureType;
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
				return r.reject(new Error('DummyEventSink.sink:OptimisticConcurrencyException(' + commit.sequenceSlot + ',' + this._streams[commit.sequenceID].length + ')'));
			}
		}
		// Dispatch the event to the dummy queue.
		this.dispatchQueue.push(commit);
		return r.resolve(true);
	}
	else{
		return r.reject(sinkError);
	}
};

/**
 * Apply all the events from a given stream ID to the object passed using the object's emit() method (as in EventEmitter).
 * 
 * @param {Object} object The object to apply the events to.
 * @param {String} stream_id The stream ID from which to load the events.
 */
DummyEventSink.prototype.rehydrate = function rehydrate(object, sequenceID, since){
	var rehydrationDeferred = when.defer();
	var rehydrateError = new Error('DummyEventSink.rehydrate:RehydrationEventRetrievalDummyFailure');
	var sinceCommit = (typeof(since) === 'number') ? Math.floor(since) : 1;
	if(sinceCommit < 1){
		return rehydrationDeferred.resolver.reject(new Error('DummyEventSink.rehydrate:Can not start applying commits since commit slot number lesser than 1!'));
	}
	rehydrateError.type = this._failureType;
	if(this._wantRehydrateSuccess){
		if(Array.isArray(this._streams[sequenceID])){
			for(var commit_idx = sinceCommit - 1; commit_idx < this._streams[sequenceID].length; ++commit_idx){
				var streamedCommit = this._streams[sequenceID][commit_idx];
				try{
					object.applyCommit(streamedCommit);
				}
				catch(err){
					return rehydrationDeferred.resolver.reject(err);
				}
				rehydrationDeferred.resolver.notify('DummyEventSink.rehydrate:progress');
			}
		}
		return rehydrationDeferred.resolver.resolve('DummyEventSink.rehydrate:resolve');
	}
	else{
		return rehydrationDeferred.resolver.reject(rehydrateError);
	}
};

module.exports.DummyEventSink = DummyEventSink;