var EventSourcedAggregateRootRepository = require('../lib/Persistence/EventSourcedAggregateRootRepository').EventSourcedAggregateRootRepository;
var EventSourcedAggregateRoot = require('../lib/Core/EventSourcedAggregateRoot').EventSourcedAggregateRoot;
var DummyEventStore = require('../lib/Dummy').DummyEventStore;
var RetryStrategy = require('../lib/Operations/RetryStrategy');
var assert = require('assert');

function DummyAggregateRoot(){
	this.ok = false;
}
DummyAggregateRoot.prototype = new EventSourcedAggregateRoot();

DummyAggregateRoot.prototype.okay = function okay(){
	this.raiseEvent('Okayed', {});
};

DummyAggregateRoot.prototype.eventHandlers.Okayed = function onOkayed(event){
	this.ok = true;
};

describe('EventSourcedAggregateRootRepository', function(){
	describe('#do', function(){
		it('should instantiate an AR from the passed constructor', function(){
			var store = new DummyEventStore();
			var repository = new EventSourcedAggregateRootRepository(store);
			return repository.do(DummyAggregateRoot, 'AR1', function(instance){
				assert.strictEqual(instance.ok, false);
			});
		});
		it('should rehydrate an aggregate and restore its previous state by re-applying events', function(){
			var store = new DummyEventStore();
			var repository = new EventSourcedAggregateRootRepository(store);
			return repository.do(DummyAggregateRoot, 'AR1', function operate(instance){
				instance.okay();
			}).then(function(){
				return repository.do(DummyAggregateRoot, 'AR1', function verifyOperationPersistence(instance){
					assert.strictEqual(instance.ok, true);
				});
			}).catch(function(operationError){
				console.error('operationError:', operationError.cause);
				throw operationError;
			});
		});
		it('should generate an operation trace on failure', function(){
			var store = new DummyEventStore();
			var repository = new EventSourcedAggregateRootRepository(store);
			return repository.do(DummyAggregateRoot, 'AR1', function failHard(instance){
				throw new Error('Expected error');
			}, {
				trace: true
			}).then(function bailOutOnUnexpectedSuccess(){
				throw new Error('Operation succeeded unexpectedly');
			}, function handleOperationError(operationError){
				assert(operationError.trace);
			});
		});
	});
});

// var store = new DummyEventStore();
// var repository = new EventSourcedAggregateRootRepository(store, null, {
// 	retryStrategy: new RetryStrategy.ExponentialBackoffRetryStrategy(5, 5, 2)
// });
// 
// var failCounter = 0;
// var maxFailures = 6;
// 
// repository.do(DummyAggregateRoot, 'AR1', function(instance){
// 	console.info('* Loaded instance:', instance);
// 	if(failCounter < maxFailures){
// 		failCounter += 1;
// 		var dummyError = new Error('Oh well, such is life...');
// 		dummyError.infrastructure = false;
// 		throw dummyError;
// 	}
// 	return 'esdf rocks!';
// }).done(function(operationValue){
// 	console.info('repository.do() finished; value = %s', operationValue);
// }, function(error){
// 	console.error(String(error));
// });