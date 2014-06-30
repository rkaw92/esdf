/**
 * @module esdf/utils/Repository
 */

var tryWith = require('./tryWith.js').tryWith;

//TODO: Following the tryWith / loader refactoring, this is the next logical step.

/**
 * A Repository facilitates loading aggregates to perform operations on them. It is a object-oriented wrapper around tryWith for all means and purposes.
 *  It is the preferred way of obtaining aggregate instances in services.
 * @constructor
 */
function Repository(loader, saver){
	if(!loader){
		throw new Error('Loader function not provided when constructing the Repository.');
	}
	if(!saver){
		throw new Error('Saver function not provided when constructing the Repository.');
	}
	/**
	 * The loader function (bound to a sink and, optionally, a snapshotter) for partial application.
	 * @type {function}
	 * @private
	 */
	this._loader = loader;
	/**
	 * The saver function, used to sink the commits supplied by an aggregate into a persistent store.
	 * @type {function}
	 * @private
	 */
	this._saver = saver;
}

/**
 * Invoke an aggregate instance and execute a function on it, committing the resulting events. This reflects tryWith's semantics regarding retries and error handling.
 * @method
 * @param {function} aggregateConstructor The constructor function used to obtain an aggregate instance before rehydration is carried out.
 * @param {string} aggregateID ID of the aggregate to load. This indicates to the sink from which stream it should rehydrate the object.
 * @param {function} userFunction The function to perform on the aggregate. It accepts the aggregate object as the sole argument and should return a promise. If a promise is not returned, the function behaves as if an already-resolved promise had been returned.
 * @param {Object} options The options object. See tryWith (from utils) for a detailed listing and description.
 * @returns {external:Promise} a promise that resolves when the user function has resolved and the events are committed to the event sink.
 */
Repository.prototype.invoke = function(aggregateConstructor, aggregateID, userFunction, options){
	return tryWith.call(undefined, this._loader, this._saver, aggregateConstructor, aggregateID, userFunction, options);
};

module.exports.Repository = Repository;