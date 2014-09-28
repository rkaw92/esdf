//NOTE: This module is called AggregateSaver. This does not imply an Event Sourcing relationship. Thus, a non-ES version may one day be used.
// Care should be taken to make the saver generic enough to allow different backing persistence mechanisms.

var when = require('when');
var pipeline = require('when/pipeline');
var Errors = require('../Errors');

function isAggregateInstance(testedObject){
	//TODO: Create a better heuristic for this. For now, since we may not assume an AR uses ES, we can not use any of the methods defined in EventSourcedAggregate, besides getAggregateID.
	return typeof(testedObject.getAggregateID) === 'function';
}

//TODO: Turn SaverStageProvider into an interface!
/**
 * @typedef SaverStageProvider
 * @property {function(IAggregateRoot): Promise.<IAggregateRoot>} persistObject
 */

/**
 * An AggregateSaver persists the state of an aggregate so that it may later be recovered using an AggregateLoader.
 * @constructor
 * @param {SaverStageProvider[]} An array of saver stage providers which contain functions to be used when persisting the aggregate's state, in the order as indicated by the array.
 */
function AggregateSaver(stageProviders){
	this._stageProviders = stageProviders;
}

/**
 * Save an aggregate's state / state changes.
 * @method
 * @public
 * @param {IAggregateRoot}
 * @returns {Promise.<IAggregateRoot>} The aggregate, after persisting. Its state may be changed by the saving process (for example, "dirty" flags on fields or an event queue may be cleared).
 */
AggregateSaver.prototype.saveAggregate = function saveAggregate(aggregateInstance){
	// Construct a promise pipeline out of our stage providers:
	var saveFunctions = this._stageProviders.map(function(provider){
		return provider.persistObject.bind(provider);
	});
	var savingPromise = pipeline(saveFunctions, aggregateInstance);
	return savingPromise.then(function(returnedInstance){
		if(!isAggregateInstance(returnedInstance)){
			throw new Errors.SaverOutputMalformedError(returnedInstance);
		}
		return returnedInstance;
	});
};

module.exports.AggregateSaver = AggregateSaver;