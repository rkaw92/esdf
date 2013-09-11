/**
 * @module esdf/utils/tryWith
 */

var when = require('when');
var enrichError = require('./enrichError.js').enrichError;
var hashTransform = require('./hashTransform.js').hashTransform;

//TODO: Document this function.
function tryWith(loaderFunction, ARConstructor, ARID, userFunction, options){
	if(!options){
		options = {}; // Because referring to undefined's properties (as could be the case below) is an error in JS.
	}
	
	// Process the provided options.
	// Delay function, used to delegate execution to the event loop some time in the future.
	var delay = (options.delegationFunction) ? options.delegationFunction : setImmediate;
	// Allow the caller to specify a failure logger function, to which all intermediate errors will be passed.
	var failureLogger = (options.failureLogger) ? options.failureLogger : function(){};
	
	// Whether to retry execution until success, even if the provided callback's promise is rejected or if it throws an exception. Should NOT normally be used. For very special cases only.
	var retryOnRejection = options.retryOnRejection;
	
	// Initialize the promise used for notifying the caller of the result.
	var callerDeferred = when.defer();
	
	// Define an internal function - this function will be called recursively (through the delay function) from within.
	function _tryWith_singlePass(){
		// Prepare an error handler function factory.
		function generateErrorHandler(errorName){
			return function _tryWith_error(err){
				enrichError(err, 'tryWithErrorType', errorName);
				failureLogger(err);
				// In both cases - optimistic concurrency exceptions and other errors - the delay is applied.
				delay(_tryWith_singlePass);
			};
		}
		// Now, instantiate actual error handler functions, from the factory defined above.
		var _tryWith_executionError = generateErrorHandler('executionError');
		var _tryWith_commitError = generateErrorHandler('commitError');
		var _tryWith_aggregateLoadingError = generateErrorHandler('aggregateLoadingError');
		
		// Delegate the loading itself to the dependency-injected loader function (hopefully, it's something useful, such as a bound repository wrapper).
		when(loaderFunction(ARConstructor, ARID),
		function _tryWith_aggregateLoaded(AR){
			// Try to execute the provided function. If the execution itself fails, do not retry.
			try{
				when(userFunction(AR),
				function _tryWith_userFunctionResolved(userFunctionResult){
					// If the callback function promise has resolved, proceed to commit.
					AR.commit().then(
					function _tryWith_commitResolved(commitResult){
						// The commit is resolved - this is the end of our work. Report a resolution to the caller.
						callerDeferred.resolver.resolve(userFunctionResult);
						// Also, if snapshotting is enabled, we can now save the snapshot "in the background".
						//TODO: snapshotting strategy - every N calls? perhaps offload this decision to the AR?
						AR.saveSnapshot();
					},
					// The commit has been rejected - use the standard error handler to retry.
					_tryWith_commitError
					);
					
				},
				function _tryWith_userFunctionRejected(reason){
					// Signal the rejection to the caller.
					callerDeferred.resolver.reject(reason);
				},
				function _tryWith_callbackProgress(notificationInfo){
					// Relay the notification to the caller. Not all that important, but nice to have!
					callerDeferred.resolver.notify(notificationInfo);
				});
			}
			catch(userFunctionException){
				(function _tryWith_callbackExceptionThrown(userFunctionException){
					// Signal the exception to the caller via a rejection of the previously-returned promise.
					callerDeferred.resolver.reject(userFunctionException);
				})(userFunctionException);
			}
		},
		_tryWith_aggregateLoadingError
		);
	}
	_tryWith_singlePass();
	
	return callerDeferred.promise;
}

module.exports.tryWith = tryWith;