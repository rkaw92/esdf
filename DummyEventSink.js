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
DummyEventSink.prototype.sink = function sink(events, stream_id, sequence_number){
	var r = when.defer().resolver;
	var sink_error = new Error('DummyEventSink.sink:reject');
	sink_error.type = this._failureType;
	if(this._wantSinkSuccess){
		var event_envelope = events;
		if(typeof(this._streams[stream_id]) === 'undefined'){
			this._streams[stream_id] = [event_envelope];
		}
		else{
			this._streams[stream_id].push(event_envelope);
		}
		return r.resolve('DummyEventSink.sink:resolve');
	}
	else{
		return r.reject(sink_error);
	}
};

/**
 * Apply all the events from a given stream ID to the object passed using the object's emit() method (as in EventEmitter).
 * 
 * @param {Object} object The object to apply the events to.
 * @param {string} stream_id The stream ID from which to load the events.
 */
DummyEventSink.prototype.rehydrate = function rehydrate(object, stream_id){
	var rehydration_deferred = when.defer();
	var rehydrate_error = new Error('DummyEventSink rehydration event retrieval failure');
	rehydrate_error.type = this._failureType;
	if(this._wantRehydrateSuccess){
		if(Array.isArray(this._streams[stream_id])){
			this._streams[stream_id].forEach(function(streamed_commit){
				object.applyCommit(streamed_commit);
				rehydration_deferred.resolver.notify('DummyEventSink.rehydrate:progress');
			});
		}
		return rehydration_deferred.resolver.resolve('DummyEventSink.rehydrate:resolve');
	}
	else{
		return rehydration_deferred.resolver.reject(rehydrate_error);
	}
};

module.exports.DummyEventSink = DummyEventSink;