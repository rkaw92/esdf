/**
 * An interface specifying how an aggregate persistor, a component responsible for persisting domain changes to application storage, should behave.
 * @interface
 */
function AggregatePersistor(){}

/**
 * Persist an aggregate's changes to application storage.
 * @method
 * @public
 * @param {module:esdf/interfaces/Aggregate~Aggregate} aggregateInstance The object changes of which should be saved.
 * @returns {Promise.<module:esdf/interfaces/Aggregate~Aggregate>} A Promises/A+ thenable which fulfills once the changes have been saved and rejects on saving errors. The resolution value is the aggregate instance itself after persisting, while the rejection reason is a raw, backend-dependent error from a lower layer.
 */
AggregatePersistor.prototype.persistAggregate = function persistAggregate(){};

module.exports.AggregatePersistor = AggregatePersistor;