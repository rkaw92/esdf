/**
 * @module esdf/utils/tryWith
 */

var when = require('when');
var enrichError = require('./enrichError.js').enrichError;
var hashTransform = require('./hashTransform.js').hashTransform;
var RetryStrategy = require('./RetryStrategy.js');

//TODO: Document this function. Point out that it is not to be used stand-alone, but rather via a repository.
//TODO: Where do snapshots/caches fit in when only a sinkFunction is provided? Perhaps an object-oriented aproach is better for extensibility.
function tryWith(loaderFunction, sinkFunction, ARConstructor, ARID, userFunction, options){
	if(!options){
		options = {}; // Because referring to undefined's properties (as could be the case below) is an error in JS.
	}
	
	// Process the provided options.
	// Delay function, used to delegate execution to the event loop some time in the future.
	var delay = (options.delegationFunction) ? options.delegationFunction : setImmediate;
	// Allow the caller to specify a failure logger function, to which all intermediate errors will be passed.
	var failureLogger = (options.failureLogger) ? options.failureLogger : function(){};

	// By default, an infinite retry strategy is employed.
	var retryStrategy = (typeof(options.retryStrategy) === 'function') ? options.retryStrategy : RetryStrategy.CounterStrategyFactory(Infinity);
	var shouldTryAgain = function shouldTryAgain(err){
		return typeof(retryStrategy(err)) !== 'object';
	};
	
	return when.promise(function loadAndCall(resolve, reject){
		// Define an internal function - this function will be called recursively (through the delay function) from within.
		function _tryWith_singlePass(){
			// Prepare an error handler function factory.
			function generateErrorHandler(errorName){
				// The function returned by this factory will be used to retry or fail and exit the whole attempt.
				return function _tryWith_error(err){
					var strategyAllowsAnotherTry = shouldTryAgain(err);
					if(strategyAllowsAnotherTry){
						// The strategy says it's ok to retry:
						enrichError(err, 'tryWithErrorType', errorName);
						failureLogger(err);
						// In both cases - optimistic concurrency exceptions and other errors - the "delay" is applied (mostly, not to overflow the stack).
						delay(_tryWith_singlePass);
					}
					else{
						// A disqualifying error, according to the strategy - no point in any retries. Give up now.
						reject(err);
					}
				};
			}
			// Now, instantiate actual error handler functions, from the factory defined above.
			var _tryWith_executionError = generateErrorHandler('executionError');
			var _tryWith_commitError = generateErrorHandler('commitError');
			var _tryWith_aggregateLoadingError = generateErrorHandler('aggregateLoadingError');
			
			// Delegate the loading itself to the dependency-injected loader function (hopefully, it's something useful, such as a bound repository wrapper).
			when(loaderFunction(ARConstructor, ARID)).done(function _tryWith_aggregateLoaded(AR){
				// Try to execute the provided function. If the execution itself fails, do not retry.
				try{
					//TODO: Do something with the "then" here. Use "done" or return a promise. Refactoring this into a separate function might be best.
					when(userFunction(AR)).then(function _tryWith_userFunctionResolved(userFunctionResult){
						// If the callback function promise has resolved, proceed to commit.
						when.try(AR.commit.bind(AR), sinkFunction, options.commitMetadata || {}).done(function _tryWith_commitResolved(commitResult){
							// The commit is resolved - this is the end of our work. Report a resolution to the caller.
							resolve(userFunctionResult);
							// Note that all snapshotting responsibility is internal to the Aggregate itself. tryWith does not make any attempts to save the aggregate's state beyond the commit operation.
						},
						// The commit has been rejected - use the standard error handler to retry.
							_tryWith_commitError
						);
						
					}, function _tryWith_userFunctionRejected(reason){
						// Signal the rejection to the caller.
						reject(reason);
					});
				}
				catch(userFunctionException){
					(function _tryWith_callbackExceptionThrown(userFunctionException){
						// Signal the exception to the caller via a rejection of the previously-returned promise.
						reject(userFunctionException);
					})(userFunctionException);
				}
			}, _tryWith_aggregateLoadingError);
		}
		_tryWith_singlePass();
	});
}

module.exports.tryWith = tryWith;