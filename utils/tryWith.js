/**
 * @module esdf/utils/tryWith
 */

var when = require('when');
var enrichError = require('./enrichError.js').enrichError;

//TODO: document this function
function tryWith(event_sink, ar_constructor, ar_id, try_callback, options){
	if(!options){
		options = {}; // Because referring to undefined's properties (as could be the case below) is an error in JS.
	}
	
	// Process the provided options.
	// Delay function, used to delegate execution to the event loop some time in the future.
	var delay = (options.delegation_function) ? options.delegation_function : setImmediate;
	// Allow the caller to specify a failure logger function, to which all intermediate errors will be passed.
	var failure_logger = (options.failure_logger) ? options.failure_logger : function(){};
	// The caller can also force all method calls to go through deduplication.
	var command_id = (typeof(options.command_id) === 'string') ? options.command_id : undefined;
	// Whether to retry execution until success, even if the provided callback's promise is rejected or if it throws an exception. Should NOT normally be used. For very special cases only.
	var retry_on_rejection = false;
	
	// Initialize the promise used for notifying the caller of the result.
	var caller_deferred = when.defer();
	
	// Define an internal function - this function will be called recursively (through the delay function) from within.
	function _tryWith_singlePass(){
		// Create the AR object via the provided constructor.
		var ar = new ar_constructor();
		ar.eventSink = event_sink;
		ar.aggregateID = ar_id;
		// Rehydrate the constructed object.
		function generateErrorHandler(error_name){
			return function _tryWith_error(err){
				enrichError(err, 'tryWith', error_name);
				failure_logger(err);
				//In both cases - optimistic concurrency exceptions and other errors - the delay is applied.
				delay(_tryWith_singlePass);
			};
		}
		var _tryWith_executionError = generateErrorHandler('executionError');
		var _tryWith_commitError = generateErrorHandler('commitError');
		var _tryWith_rehydrationError = generateErrorHandler('rehydrationError');
		
		event_sink.rehydrate(ar, ar_id).then(
			function _tryWith_rehydrated(){
				// Try to execute the provided function. If the execution itself fails, do not retry.
				try{
					when(try_callback(ar),
					function _tryWith_callbackResolved(userfunc_result){
						// If the whole callback function has resolved, proceed to commit.
						ar.commit(command_id).then(
						function _tryWith_commitResolved(commit_result){
							// The commit is resolved - this is the end of our work. Report a resolution to the caller.
							caller_deferred.resolver.resolve(userfunc_result);
						},
						// The commit has been rejected - use the standard error handler to retry.
						_tryWith_commitError
						);
						
					},
					function _tryWith_callbackRejected(reason){
						if(!retry_on_rejection){
							// Normal mode: signal the rejection to the caller.
							caller_deferred.resolver.reject(reason);
						}
						else{
							// Retry mode: handle this like a commit error in normal mode and try again.
							_tryWith_executionError(reason);
						}
					},
					function _tryWith_callbackProgress(notification_info){
						// Relay the notification to the caller. Not all that important, but nice to have!
						caller_deferred.resolver.notify(notification_info);
					});
				}
				catch(try_callback_exception){
					(function _tryWith_callbackThrewException(try_callback_exception){
						if(!retry_on_rejection){
							// Normal mode: signal the exception to the caller via a rejection of the previously-returned promise.
							caller_deferred.resolver.reject(try_callback_exception);
						}
						else{
							// Retry mode: handle this like a commit error in normal mode and try again.
							_tryWith_executionError(try_callback_exception);
						}
					})(try_callback_exception);
				}
			},
			_tryWith_rehydrationError
		);
	}
	_tryWith_singlePass();
	
	return caller_deferred.promise;
};

module.exports.tryWith = tryWith;