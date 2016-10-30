/**
 * @module esdf/utils/Repository
 */

'use strict';

const when = require('when');
const RetryStrategies = require('../strategies/retry');

/**
 * A Repository facilitates loading aggregates to perform operations on them.
 * It is the preferred way of obtaining aggregate instances in services.
 * @class
 */
class Repository {
	/**
	 * Obtain a new Repository instance.
	 * @constructor
	 * @param {Object} components - The components necessary for loading aggregates.
	 * @param {Object} components.sink - The EventSink to use for rehydration and committing.
	 * @param {Object} [components.snapshotter] - The Snapshotter component for getting auxiliary snapshots of Aggregate Roots' state at some point in the past.
	 */
	constructor({ sink, snapshotter }, options = {}) {
		this._sink = sink;
		this._snapshotter = snapshotter;
		this._options = options;
	}
	
	/**
	 * Invoke an aggregate instance and execute a function on it, committing the resulting events. This reflects tryWith's semantics regarding retries and error handling.
	 * @method
	 * @param {function} aggregateConstructor - The constructor function used to obtain an aggregate instance before rehydration is carried out.
	 * @param {string} aggregateID - ID of the aggregate to load. This indicates to the sink from which stream it should rehydrate the object.
	 * @param {function} userFunction - The function to perform on the aggregate. It accepts the aggregate object as the sole argument and should return a promise. If a promise is not returned, the function behaves as if an already-resolved promise had been returned.
	 * @param {Object} options - The options object. See tryWith (from utils) for a detailed listing and description.
	 * @returns {external:Promise} a promise that resolves when the user function has resolved and the events are committed to the event sink.
	 */
	invoke(aggregateConstructor, aggregateID, userFunction, options) {
		return this._tryWith(aggregateConstructor, aggregateID, userFunction, options);
	}
	
	_loadSnapshot(aggregateInstance) {
		if (this._snapshotter && aggregateInstance.supportsSnapshotApplication()) {
			return when.try(snapshotter.loadSnapshot.bind(snapshotter), aggregateInstance.getAggregateType(), aggregateID).then(function _applySnapshot(snapshot){
				// A snapshot has been found and loaded, so let the AR apply it to itself, according to its internal logic.
				return when.try(ARObject.applySnapshot.bind(ARObject), snapshot);
			}, function _snapshotNonexistent() {
				// This function intentionally does nothing. It simply turns a rejection from loadSnapshot() into a resolution.
				//TODO: Put an event-emitting statement here once we have logging support in place.
			});
		}
		else {
			return when.resolve();
		}
	}
	
	_rehydrateAggregate(aggregateInstance, diffSince) {
		// We need to load the aggregate's events since the earlier of the two points: diffSince and the initial state as obtained from e.g. a snapshot.
		// However, we will only be applying those events which are actually newer than the current state. Some will simply be gathered and returned informationally as requested.
		const loadFromSlot = Math.min(aggregateInstance.getNextSequenceNumber(), diffSince + 1);
		//TODO: Optionally limit the length of returned diffs by computing the difference between loadFromSlot and ARObject.getNextSequenceNumber() as a DoS prevention measure.
		// Obtain a stream of commits that we will be processing one by one:
		let commitStream;
		
		// Process the stream:
		var diffCommits = [];
		
		return when.try(this._sink.getCommitStream.bind(this._sink), aggregateInstance.getAggregateID(), loadFromSlot).then(function(producedStream) {
			commitStream = producedStream
			return when.promise(function(resolve, reject) {
				commitStream.on('data', function processStreamedCommit(commit) {
					try {
						// Only apply those commits which have not been applied already to the aggregate root's state:
						if (commit.sequenceSlot >= aggregateInstance.getNextSequenceNumber()) {
							aggregateInstance.applyCommit(commit);
						}
						// If we've moved above the "diffSince" moment, everything since then is a difference, so add it to the list:
						if (commit.sequenceSlot > diffSince) {
							diffCommits.push(commit);
						}
					}
					catch (error) {
						reject(error);
					}
				});
				
				commitStream.on('end', function() {
					resolve({
						diffCommits: diffCommits
					});
				});
				
				commitStream.on('error', function(streamError) {
					reject(streamError);
				});
			});
		});
	}
	
	_loadAggregate(aggregateConstructor, aggregateID, { diffSince = Infinity } = {}) {
		const self = this;
		const eventSink = self._sink;
		const snapshotter = self._snapshotter;
		
		const aggregateInstance = new aggregateConstructor();
		aggregateInstance.setAggregateID(aggregateID);
		
		return this._loadSnapshot(aggregateInstance).then(function() {
			return self._rehydrateAggregate(aggregateInstance, diffSince);
		}).then(function(rehydrationResult) {
			return {
				instance: aggregateInstance,
				rehydration: rehydrationResult
			};
		});
	}
	
	_persistAggregate(aggregateInstance, commitMetadata = {}) {
		const commitObject = aggregateInstance.getCommit(commitMetadata);
		return this._sink.sink(commitObject).then(function _commitSucceeded() {
			aggregateInstance.advanceState(commitObject);
			//TODO: Support snapshotting.
		});
	}
	
	/**
	 * Load an Aggregate Root instance and execute a function on it.
	 * @param {function} aggregateConstructor - A constructor which, when called with "new", should return an Aggregate Root instance in its base (zero) state. Used by the loader function.
	 * @param {string} aggregateID - ID of the Aggregate Root to load. The storage unit (for example, event stream) associated with this ID is loaded and used to restore the state of the AR.
	 * @param {function} userFunction - The function that will be executed against the Aggregate Root instance after it has been rehydrated. It accepts a single argument - the instance - and should return a promise-or-value. The aggregate's state is only saved once the promise resolves.
	 * @param {Object} [options] - Additional settings specifying how the load/execute/save operation should be carried out.
	 * @param {function} [options.failureLogger] - A function which shall be called if an error during loading or saving occurs. The error is passed as the sole argument to the failure logger function.
	 * @param {Boolean} [options.advanced=false] - Whether advanced return mode should be enabled. In advanced mode, the returned object is not the userFunction result itself, but instead an Object: { result, rehydration }, where rehydration is additional information about the loading process itself.
	 * @param {Number} [options.diffSince=Infinity] - A sequence slot to compute a difference from in advanced mode. All commits in slots greater than this value are returned, barring the commit that is generated in the current invocation (unless "newCommits" is used).
	 * @param {Boolean} [options.newCommits=false] - Whether the commit generated in course of executing the user function should be included in diffCommits. By default, only past commits that have existed at time of loading are returned.
	 * @returns {Promise} A Promise which fulfills with the value which the userFunction has returned/fulfilled with, or rejects if the loading, execution of the user function or the saving failed. In advanced mode, it resolves with an Object that contains the value and other properties.
	 */
	_tryWith(aggregateConstructor, aggregateID, userFunction, options = {}) {
		const self = this;
		
		// Process the provided options.
		// Delay function, used to delegate execution to the event loop some time in the future.
		const delegationFunction = (options.delegationFunction) ? options.delegationFunction : setImmediate;
		function delay(continuation) {
			return when.promise(function(resolve){
				delegationFunction(resolve);
			}).then(continuation);
		}
		// Allow the caller to specify a failure logger function, to which all intermediate errors will be passed.
		const failureLogger = (options.failureLogger) ? options.failureLogger : function(){};

		// By default, an infinite retry strategy is employed.
		const retryStrategy = (typeof(options.retryStrategy) === 'function') ? options.retryStrategy : RetryStrategies.CounterStrategyFactory(Infinity);
		function shouldTryAgain(error){
			const strategyError = retryStrategy(error);
			// The strategy should tell us whether it thinks retrying is reasonable:
			const strategyRetryDecision = (!strategyError);
			// However, we do not have to agree with it - all critical errors, no matter what the strategy has decided, should fail the tryWith procedure.
			const ownDecision = (error && error.labels && error.labels.isRetriable);
			
			return strategyRetryDecision && ownDecision;
		};
		
		function singlePass() {
			// Get an up-to-date instance of our Aggregate Root class:
			return self._loadAggregate(aggregateConstructor, aggregateID, {
				// Pass the diffSince option through to recover event history from a certain point if requested:
				diffSince: options.diffSince
			}).then(function runUserFunction(loadingResult) {
				const aggregateInstance = loadingResult.instance;
				let stagedCommit;
				
				return when.try(userFunction, aggregateInstance).then(function saveAggregateState(userFunctionResult) {
					// Get the events staged by the aggregate root in course of execution and eventually append them to the result if requested.
					stagedCommit = aggregateInstance.getCommit(options.commitMetadata || {});
					
					// Actually commit:
					return self._persistAggregate(aggregateInstance, options.commitMetadata || {}).then(function constructReturnValue() {
						// If the caller has requested an "advanced format" result, pass the data through to them, enriched with the result of the user function.
						if (options.advanced) {
							const output = {
								result: userFunctionResult,
								rehydration: loadingResult.rehydration
							};
							// Additionally, if "newCommits" is enabled, also add the events produced by the current invocation to the returned property.
							if (options.newCommits) {
								output.rehydration.diffCommits = (output.rehydration.diffCommits || []).concat([ stagedCommit ]);
							}
							return output;
						}
						else {
							return userFunctionResult;
						}
					});
				});
			}, function handleError(error) {
				// An error has occurred during the rehydration, action execution, or saving phase.
				failureLogger(error);
				const strategyAllowsAnotherTry = shouldTryAgain(error);
				if (strategyAllowsAnotherTry) {
					return delay(singlePass);
				}
				else {
					return when.reject(error);
				}
			});
		}
		
		return singlePass();
	}
}

module.exports = Repository;
