/**
 * @module esdf/test/DummyEventSink
 */

var when = require('when');

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
	 * The type of failure to enrich the error with when a failure is requested via _want_success=false.
	 * @public
	 */
	this._failureType = 'DummyEventSink test failure';
	/**
	 * The event streams holding the sunk data.
	 * @private
	 */
	this._streams = {};
};

/**
 * Attempts to save a commit (array of event objects) into the Event Store. Returns a promise which resolves upon a successful save and is rejected on any error (with the error being the rejection reason verbatim).
 * Since this is only a dummy Event Sink, all events are only saved into a temporary object, and are discarded when the DummyEventSink is destroyed.
 * 
 * @param {Array} events The commit of events to save to the in-memory temporary database.
 * @param {string} stream_id The stream ID under which the commit should be saved. Typically, this is equal to the Aggregate Root ID.
 * @param {number} sequence_number The sequence number to save the commit under. Only one commit within a given stream ID can occupy each sequence number.
 */
DummyEventSink.prototype.sink = function sink(events, streamID, sequenceNumber, metadata){
	var r = when.defer().resolver;
	var sinkError = new Error('DummyEventSink.sink:reject');
	sinkError.type = this._failureType;
	if(this._wantSinkSuccess){
		var eventEnvelope = events;
		if(metadata){
			for(var k in metadata){
				eventEnvelope[k] = metadata[k];
			}
		}
		if(typeof(this._streams[streamID]) === 'undefined'){
			this._streams[streamID] = [eventEnvelope];
		}
		else{
			this._streams[streamID].push(eventEnvelope);
		}
		return r.resolve('DummyEventSink.sink:resolve');
	}
	else{
		return r.reject(sinkError);
	}
};

/**
 * Apply all the events from a given stream ID to the object passed using the object's emit() method (as in EventEmitter).
 * 
 * @param {Object} object The object to apply the events to.
 * @param {string} stream_id The stream ID from which to load the events.
 */
DummyEventSink.prototype.rehydrate = function rehydrate(object, streamID, options){
	if(!options){
		options = {};
	}
	var rehydrationDeferred = when.defer();
	var commandSeen = false;
	var rehydrateError = new Error('DummyEventSink rehydration event retrieval failure');
	rehydrateError.type = this._failureType;
	if(this._wantRehydrateSuccess){
		if(Array.isArray(this._streams[streamID])){
			for(var commit_idx = 0; commit_idx < this._streams[streamID].length; ++commit_idx){
				var streamedCommit = this._streams[streamID][commit_idx];
				// Halt right before this command ID, since the caller has asked us to do so.
				if(typeof(options.untilCommandID) === 'string' && streamedCommit.CommandID === options.untilCommandID){
					// Make sure to notify the caller about encountering the command ID.
					commandSeen = true;
					break;
				}
				object.applyCommit(streamedCommit);
				rehydrationDeferred.resolver.notify('DummyEventSink.rehydrate:progress');
			}
		}
		return rehydrationDeferred.resolver.resolve({origin: 'DummyEventSink.rehydrate:resolve', commandSeen: commandSeen});
	}
	else{
		return rehydrationDeferred.resolver.reject(rehydrateError);
	}
};

module.exports.DummyEventSink = DummyEventSink;