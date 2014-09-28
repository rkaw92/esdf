var when = require('when');
var Exception = require('../Util/Exception');
var util = require('util');

function isRecoverable(error){
	if(error.concurrency || error.infrastructure){
		return true;
	}
	else{
		return false;
	}
}

function RetryException(message, underlyingError){
	return new Exception(function(){
		this.name = 'RetryException';
		this.message = message;
		this.setCause(underlyingError);
	});
}

function UnrecoverableErrorException(message, underlyingError){
	return new Exception(function(){
		this.name = 'UnrecoverableErrorException';
		this.message = message;
		this.setCause(underlyingError);
	});
}

function NoRetryStrategy(){
	return function noRetry(error, operation){
		return when.reject(new RetryException('NoRetryStrategy: The operation has failed and the no-retry strategy refuses to retry it. Aborting.', error));
	};
}

function ExponentialBackoffRetryStrategy(initialBackoff, maxRetries, delayMultiplier){
	// Get the user-supplied multiplier to multiply the delay by, in every step of the back-off iteration. By default, we use the golden ratio, because it just feels nice.
	var multiplier = Number(delayMultiplier) || 1.618;
	// Specify the initial retry delay in ms. Defaults to 8.
	var delay = Number(initialBackoff) || 8;
	// Set the retry countdown.
	var remainingRetries = Number(maxRetries) || 8;
	return function exponentialBackoff(error, operation){
		if(!isRecoverable(error)){
			return when.reject(new UnrecoverableErrorException('ExponentialBackoffRetryStrategy: The encountered error is non-recoverable. Aborting operation.', error));
		}
		if(remainingRetries > 0){
			remainingRetries -= 1;
			delay *= multiplier;
			return when.resolve().delay(delay).then(function(){
				return operation();
			});
		}
		else{
			return when.reject(new RetryException('ExponentialBackoffRetryStrategy: Retry limit reached, aborting retry.', error));
		}
	};
}

module.exports.isRecoverable = isRecoverable;
module.exports.NoRetryStrategy = NoRetryStrategy;
module.exports.ExponentialBackoffRetryStrategy = ExponentialBackoffRetryStrategy;