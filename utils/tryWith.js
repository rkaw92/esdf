/**
 * @module esdf/utils/tryWith
 */

var when = require('when');
var enrichError = require('./enrichError.js').enrichError;
var DummyEventSink = require('../DummyEventSink.js').DummyEventSink;

//TODO: document this function
function tryWith(eventSink, ARConstructor, ARID, userFunction, options){
	if(!options){
		options = {}; // Because referring to undefined's properties (as could be the case below) is an error in JS.
	}
	
	// Process the provided options.
	// Delay function, used to delegate execution to the event loop some time in the future.
	var delay = (options.delegationFunction) ? options.delegationFunction : setImmediate;
	// Allow the caller to specify a failure logger function, to which all intermediate errors will be passed.
	var failureLogger = (options.failureLogger) ? options.failureLogger : function(){};
	// The caller can also request that a previous state of the AR be loaded, so that an idempotent operation may be replayed.
	// In case of a replay (duplicate commandID), the events will end up in a dummy sink and eventually be discarded, unless special action is taken by the programmer.
	var commandID;
	// Create a standby alternate EventSink, to be used if doing a command replay (we don't know if we are doing it yet, so it needs to be created and kept in this variable until we do).
	var alternateEventSink = new DummyEventSink();
	// Define a normal event sink, used for sinking commits when not in replay mode. Replaced by a wrapper (see below) if idempotency mode is enabled (i.e. commandID is present).
	var normalEventSink = eventSink;
	var rehydrationOptions = {};
	if(typeof(options.commandID) === 'string'){
		commandID = options.commandID;
		// Use a dummy sink, so that an "alternate reality" is modelled separately. This allows for harmless idempotency (re-issuing of the same command twice with the same preceived results) and, possibly, some interesting simulations.
		// Tell the rehydration sink to only get us commits up to this command ID (no typo here!).
		rehydrationOptions.untilCommandID = commandID;
		// Overlay a thin, single-method wrapper over EventSink so that command IDs are saved with each commit.
		normalEventSink = {
			sink: function(eventType, eventObject, sequenceNumber){
				return eventSink.sink(eventType, eventObject, sequenceNumber, {CommandID: commandID});
			}
		};
	}
	// Whether to retry execution until success, even if the provided callback's promise is rejected or if it throws an exception. Should NOT normally be used. For very special cases only.
	var retryOnRejection = options.retryOnRejection;
	
	// Initialize the promise used for notifying the caller of the result.
	var callerDeferred = when.defer();
	
	// Define an internal function - this function will be called recursively (through the delay function) from within.
	function _tryWith_singlePass(){
		// Create the AR object via the provided constructor.
		var AR = new ARConstructor();
		AR.eventSink = normalEventSink;
		AR.aggregateID = ARID;
		// Rehydrate the constructed object.
		function generateErrorHandler(errorName){
			return function _tryWith_error(err){
				enrichError(err, 'tryWith', errorName);
				failureLogger(err);
				// In both cases - optimistic concurrency exceptions and other errors - the delay is applied.
				delay(_tryWith_singlePass);
			};
		}
		var _tryWith_executionError = generateErrorHandler('executionError');
		var _tryWith_commitError = generateErrorHandler('commitError');
		var _tryWith_rehydrationError = generateErrorHandler('rehydrationError');
		
		// Use the original event sink to rehydrate the AR. (Note that we can not use AR.eventSink, as it may have been replaced by the alternate for command deduplication.)
		eventSink.rehydrate(AR, ARID, rehydrationOptions).then(
			function _tryWith_rehydrated(rehydrationMetadata){
				// If the command has previously been seen, it means that the AR must have stopped loading the commits the moment it saw it.
				//  Thus, what we have is a "snapshot" from some point in the past. This makes us want to redirect all event output into a dummy sink, so that execution may continue without seqnum collisions (optimistic concurrency).
				//  This way, the AR will be able to re-execute the command (and all methods that it comprises) and yield exactly the same results without impacting the real application state.
				// NOTE: idempotency only works automatically if all operations on the AR are deterministic. For dealing with non-determinism, see the Non-Deterministic Method Application Note in the documentation.
				if(rehydrationMetadata.commandSeen){
					AR.eventSink = alternateEventSink; // Replace the sink.
					AR.currentCommandID = commandID; // Let the AR do its internal replay magic, in case it is not naturally idempotent.
				}
				// Try to execute the provided function. If the execution itself fails, do not retry.
				try{
					when(userFunction(AR),
					function _tryWith_userFunctionResolved(userFunctionResult){
						// If the callback function promise has resolved, proceed to commit.
						AR.commit(commandID).then(
						function _tryWith_commitResolved(commitResult){
							// The commit is resolved - this is the end of our work. Report a resolution to the caller.
							callerDeferred.resolver.resolve(userFunctionResult);
						},
						// The commit has been rejected - use the standard error handler to retry.
						_tryWith_commitError
						);
						
					},
					function _tryWith_userFunctionRejected(reason){
						if(!retryOnRejection){
							// Normal mode: signal the rejection to the caller.
							callerDeferred.resolver.reject(reason);
						}
						else{
							// Retry mode: handle this like a commit error in normal mode and try again.
							_tryWith_executionError(reason);
						}
					},
					function _tryWith_callbackProgress(notificationInfo){
						// Relay the notification to the caller. Not all that important, but nice to have!
						callerDeferred.resolver.notify(notificationInfo);
					});
				}
				catch(userFunctionException){
					(function _tryWith_callbackThrewException(userFunctionException){
						if(!retryOnRejection){
							// Normal mode: signal the exception to the caller via a rejection of the previously-returned promise.
							callerDeferred.resolver.reject(userFunctionException);
						}
						else{
							// Retry mode: handle this like a commit error in normal mode and try again.
							_tryWith_executionError(userFunctionException);
						}
					})(userFunctionException);
				}
			},
			_tryWith_rehydrationError
		);
	}
	_tryWith_singlePass();
	
	return callerDeferred.promise;
};

module.exports.tryWith = tryWith;