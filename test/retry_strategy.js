var RetryStrategy = require('../utils/RetryStrategy.js');
var assert = require('assert');
var enrichError = require('../utils/enrichError.js').enrichError;

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
	describe('.NoRetryStrategyFactory', function(){
		it('should not retry at all', function(){
			// Yes, it is similar to the first CounterStrategyFactory, indeed. That's because it's an alias, and we want to know the aliasing worked.
			var denier = RetryStrategy.NoRetryStrategyFactory();
			assert(denier() instanceof Error);
		});
	});
	describe('.LabelCheckStrategyFactory', function(){
		var looker = RetryStrategy.LabelCheckStrategyFactory('denyRetry');
		it('should retry, not having seen the designated label on the object', function(){
			assert(looker(new Error()) === undefined);
		});
		it('should refuse to retry', function(){
			var offendingError = new Error();
			enrichError(offendingError, 'denyRetry', true);
			assert(looker(offendingError) instanceof Error);
		});
	});
	describe('.CriticalStrategyFactory', function(){
		var looker = RetryStrategy.CriticalStrategyFactory();
		it('should retry, not having seen the "critical" label on the object', function(){
			assert(looker(new Error()) === undefined);
		});
		it('should refuse to retry', function(){
			var offendingError = new Error();
			enrichError(offendingError, 'critical', true);
			assert(looker(offendingError) instanceof Error);
		});
	});
	describe('.CombinedStrategyFactory', function(){
		var uselessStrategy = RetryStrategy.CombinedStrategyFactory([RetryStrategy.CriticalStrategyFactory, RetryStrategy.NoRetryStrategyFactory]);
		it('should utterly fail to retry because the combined strategy\'s NoRetryStrategy component disallows it', function(){
			var err = uselessStrategy(new Error());
			// The only underlying error reported by the combined strategy factory is the counter error - the critical refusal strategy does not generate one.
			assert(err instanceof Error && err.labels.originalErrors[0].labels.strategy === 'CounterStrategy');
		});
	});
});