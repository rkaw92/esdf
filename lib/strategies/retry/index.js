var util = require('util');

function RetryStrategyLimitError(strategy, message, originalErrors){
	this.name = 'RetryStrategyLimitError';
	this.message = message;
	this.labels = {
		originalErrors: (Array.isArray(originalErrors) ? originalErrors : [originalErrors]),
		strategy: strategy
	};
}
util.inherits(RetryStrategyLimitError, Error);

function CombinedStrategyFactory(strategyFactories){
	var strategies = [];
	strategyFactories.forEach(function(factory){
		// Use the factory to generate the strategy function, then push it onto the list.
		strategies.push(factory());
	});
	return (function CombinedStrategy(lastError){
		// Now we have the strategies in the list - check what they all say.
		var strategyErrors = strategies.reduce(function(previousValue, currentStrategy){
			var currentStrategyError = currentStrategy(lastError);
			if(currentStrategyError){
				previousValue.push(currentStrategyError);
			}
			return previousValue;
		}, []);
		if(strategyErrors.length > 0){
			return new RetryStrategyLimitError('CombinedStrategy', 'A combined strategy', strategyErrors);
		}
		else{
			return undefined;
		}
	});
}


function CounterStrategyFactory(counter){
	var currentCounter = Number(counter);
	return (function CounterStrategy(lastError){
		if(currentCounter-- <= 0){
			return new RetryStrategyLimitError('CounterStrategy', 'Retry count limit of ' + counter + ' reached.', lastError);
		}
	});
}

var NoRetryStrategyFactory = CounterStrategyFactory.bind(undefined, 0);

function LabelCheckStrategyFactory(flag){
	return (function LabelCheckStrategy(lastError){
		if (lastError[flag]){
			return new RetryStrategyLimitError('CriticalCheckStrategy', 'Encountered a "' + flag + '" error - refusing to retry.', lastError);
		}
	});
}

var CriticalStrategyFactory = LabelCheckStrategyFactory.bind(undefined, 'critical');
var LogicStrategyFactory = LabelCheckStrategyFactory.bind(undefined, 'logic');

module.exports.CombinedStrategyFactory = CombinedStrategyFactory;
module.exports.CounterStrategyFactory = CounterStrategyFactory;
module.exports.NoRetryStrategyFactory = NoRetryStrategyFactory;
module.exports.LabelCheckStrategyFactory = LabelCheckStrategyFactory;
module.exports.CriticalStrategyFactory = CriticalStrategyFactory;
