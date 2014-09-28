var when = require('when');
var Commit = require('../Core/Commit').Commit;
var RetryStrategy = require('../Operations/RetryStrategy');
var Exception = require('../Util/Exception');

function AggregateRootEnvelope(instance){
	this.instance = instance;
	this.sequenceID = instance.getAggregateID();
	this.sequenceSlot = 1;
	this.operationValue = undefined;
}

function EventSourcedAggregateRootRepository(eventStore, snapshotStore, options){
	this._eventStore = eventStore;
	this._options = options || {};
}

EventSourcedAggregateRootRepository.prototype.do = function do_(aggregateRootConstructor, aggregateRootID, operation, options){
	var eventStore = this._eventStore;
	var options = options || {};
	var retryStrategy = options.retryStrategy || this._options.retryStrategy || RetryStrategy.NoRetryStrategy();
	
	// Note: the different stages throughout this function use conditional assignment to handle both the case of immutable objects (where every setter returns the modified target) and the case when functions return undefined.
	//  If the functions do return truthy values which are not compatible with the Event Sourced Aggregate contract, however, an erorr occurs.
	function load(){
		var instance = new aggregateRootConstructor()
		instance = instance.setAggregateID(aggregateRootID) || instance;
		var envelope = new AggregateRootEnvelope(instance);
		delete instance;
		//TODO: Load snapshots first.
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
		return when.try(load).then(process).then(optionalSeal).then(save);
	}
	
	function tryDoing(){
		return singlePass().catch(function handleOperationError(underlyingError){
			// Let our retry strategy carry out the operation again if possible:
			var retryPromise = retryStrategy(underlyingError, tryDoing);
			// Then, if the strategy has rejected as well (meaning a non-recoverable error according to its logic), report failure to the caller.
			return retryPromise;
		});
	}
	
	return tryDoing().then(function yieldOperationValue(envelope){
		return envelope.operationValue;
	});
};

module.exports.EventSourcedAggregateRootRepository = EventSourcedAggregateRootRepository;