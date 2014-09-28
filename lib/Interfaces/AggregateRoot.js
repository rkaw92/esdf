/**
 * An interface for Aggregate Roots. An Aggregate Root is the only directly accessible part of a Domain-Driven application. It is referenced by its unique ID and corresponds to an entity whose identity is the ID.
 * @interface
 */
function IAggregateRoot(){}

/**
 * Get the aggregate's unique identity string (ID).
 * @method
 * @public
 * @returns {string} The aggregate ID.
 */
IAggregateRoot.prototype.getAggregateID = function getAggregateID(){};

/**
 * Set the aggregate's ID.
 * @method
 * @public
 * @param {string} ID The ID to set.
 * @returns {IAggregateRoot} The object whose ID has been set (to which this method belongs).
 */
IAggregateRoot.prototype.setAggregateID = function setAggregateID(){};

module.exports.IAggregateRoot = IAggregateRoot;