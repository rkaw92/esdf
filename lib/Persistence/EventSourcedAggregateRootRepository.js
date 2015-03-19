var when = require('when');
var Commit = require('../Core/Commit').Commit;
var RetryStrategy = require('../Operations/RetryStrategy');
var Trace = require('../Util/Trace');

function AggregateRootEnvelope(instance, aggregateID){
	this.instance = instance;
	this.sequenceID = aggregateID;
	this.sequenceSlot = 1;
	this.operationValue = undefined;
}

AggregateRootEnvelope.prototype.copy = function copy(){
	var envelope = new AggregateRootEnvelope(instance);
	envelope.sequenceSlot = this.sequenceSlot;
	envelope.operationValue = this.operationValue;
	return envelope;
};

function EventSourcedAggregateRootRepository(eventStore, snapshotStore, options){
	this._eventStore = eventStore;
	this._options = options || {};
}

EventSourcedAggregateRootRepository.prototype.do = function do_(aggregateRootConstructor, aggregateRootID, operation, options){
	var eventStore = this._eventStore;
	var options = options || {};
	var retryStrategy = options.retryStrategy || this._options.retryStrategy || RetryStrategy.NoRetryStrategy();
	var operationTrace = options.trace ? Trace.Trace() : null;
	var generateLogs = (options.trace || options.logger);
	var logOrigin = 'EventSourcedAggregateRootRepository.prototype.do';
	var Occurence = Trace.getOccurenceConstructor(logOrigin);
	
	function log(occurence){
		if(options.trace){
			operationTrace.add(occurence);
		}
		return (options.logger ? when.try(options.logger, occurence) : when.resolve());
	}
	
	// Note: the different stages throughout this function use conditional assignment to handle both the case of immutable objects (where every setter returns the modified target) and the case when functions return undefined.
	//  If the functions do return truthy values which are not compatible with the Event Sourced Aggregate contract, however, an erorr occurs.
	function load(){
		var instance = new aggregateRootConstructor();
		var envelope = new AggregateRootEnvelope(instance, aggregateRootID);
		delete instance;
		//TODO: Load snapshots first, if a store has been provided during construction.
		return when.try(eventStore.streamSequenceCommits.bind(eventStore), envelope.sequenceID, envelope.sequenceSlot, function processCommit(commit){
			commit.events.forEach(function passEvent(event){
				envelope.instance = envelope.instance.processEvent(event) || envelope.instance;
			});
			++envelope.sequenceSlot;
		}).yield(envelope);
	}
	
	function process(envelope){
		return when.try(operation, envelope.instance).then(function(result){
			// Although we provide support for immutable objects by default, we also need to make sure functions work as expected with mutable object implementations which return nothing / garbage values.
			if(result && typeof(result.getAggregateID) === 'function'){
				envelope.instance = result;
			}
			else{
				envelope.operationValue = result;
			}
			return envelope;
		});
	}
	
	function optionalSeal(envelope){
		// Optionally apply safety guards to the aggregate, so that programmer mistakes are easily detected. This requires the target to implement an extra function.
		// Also, this safety measure does not work with immutable objects - if working with immutable aggregates, the programmer is expected to always yield the aggregate's final state from the function/returned promise, anyway.
		if(typeof(envelope.instance.seal) === 'function'){
			envelope.instance.seal();
		}
		return envelope;
	}
	
	function save(envelope){
		var events = envelope.instance.getNewEvents();
		// Guard clause: in case of no changes whatsoever, exit early without saving a Commit.
		if(events.length === 0){
			return envelope;
		}
		var commit = new Commit(envelope.sequenceID, envelope.sequenceSlot, events);
		return when.try(eventStore.saveCommit.bind(eventStore), commit).then(function clearAggregateEvents(){
			return envelope.instance.clearEvents(events[events.length - 1]);
		}).yield(envelope);
	}
	
	function singlePass(){
		function logCompletion(type, envelope){
			// Guard clause: If neither tracing nor logging have been requested, there is no point in generating Occurences.
			if(!generateLogs){
				return when.resolve(envelope);
			}
			return when.try(log, Occurence(type, {
				envelope: envelope.copy()
			})).yield(envelope);
		}
		return when.try(load)
			.then(logCompletion.bind(undefined, 'loaded'))
			.then(process)
			.then(logCompletion.bind(undefined, 'processed'))
			.then(optionalSeal)
			.then(save)
			.then(logCompletion.bind(undefined, 'saved'));
	}
	
	function tryDoing(){
		return singlePass().catch(function handleOperationError(underlyingError){
			// First, make sure the error is properly remembered/logged for recalling later.
			// Depending on the caller's intentions, the logger function may return early or it may return the logging promise proper, so that log persistence is assured before going forward.
			return when.try(log, Occurence('error', underlyingError)).then(function(){
				// Let our retry strategy carry out the operation again if possible:
				var retryPromise = retryStrategy(underlyingError, tryDoing);
				// Then, if the strategy has rejected as well (meaning a non-recoverable error according to its logic), report failure to the caller.
				//TODO: Split up determining whether to retry from retrying. If the strategy refuses to retry at all, return the original error.
				//TODO: Change the retry strategies' code contract so that they do not generate own errors on retries.
				return retryPromise;
			});
		});
	}
	
	//TODO: Make sure that critical errors bubble up without the strategy no-retry error wrapping them.
	return tryDoing().then(function yieldOperationValue(envelope){
		return envelope.operationValue;
	}).catch(function provideTrace(strategyError){
		// If we have reached this point, there must have been some errors and the strategy has given up on retries.
		// Make sure the caller gets the operation trace if it is at all possible to enrich the "error" object with it.
		if(strategyError){
			strategyError.trace = operationTrace;
		}
		return when.reject(strategyError);
	});
};

module.exports.EventSourcedAggregateRootRepository = EventSourcedAggregateRootRepository;