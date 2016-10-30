var RetryStrategy = require('../lib/strategies/retry');
var assert = require('assert');

describe('RetryStrategy', function(){
	describe('.CounterStrategyFactory', function(){
		it('should not retry at all', function(){
			var counter = RetryStrategy.CounterStrategyFactory(0);
			assert(counter() instanceof Error);
		});
		it('should retry exactly once', function(){
			var counter = RetryStrategy.CounterStrategyFactory(1);
			assert(counter() === undefined);
			assert(counter() instanceof Error);
		});
	});
});
