/**
 * This interface specifies the operations that need to be implemented by all Aggregate Roots.
 * An Aggregate Root represents an entity (an independent object that is not contained within others in DDD), which has an identity.
 * That identity is reflected by a unique ID in the AR - if the IDs of two aggregate roots are equal, they must be the same entity.
 * @interface
 */
function IAggregateRoot(){}

/**
 * Get the Aggregate ID (entity ID) of the Aggregate Root object.
 * @method
 * @public
 * @abstract
 * @returns {string} The aggregate ID.
 */
IAggregateRoot.prototype.getAggregateID = function getAggregateID(){};

/**
 * Set the ID of the entity that the Aggregate Root object is supposed to represent.
 * @method
 * @public
 * @abstract
 * @param {string} aggregateID The new ID to assign.
 * @returns {IAggregateRoot} The object whose setAggregateID was called. This enables call chaining and, if the implementation allows it, immutability.
 */
IAggregateRoot.prototype.setAggregateID = function setAggregateID(){};

module.exports.IAggregateRoot = IAggregateRoot;