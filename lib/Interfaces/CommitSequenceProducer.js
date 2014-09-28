/**
 * This interface specifies the behaviour of objects which are event/commit sources, such as event-sourced aggregates.
 * @interface
 */
function CommitSequenceProducer(){}

/**
 * Get the unique ID of the sequence. For most persistence mechanisms, this determines some kind of key used for the sequence.
 * @method
 * @public
 * @returns {string} The sequence ID.
 */
CommitSequenceProducer.prototype.getSequenceID = function getSequenceID(){};

/**
 * Get the sequence type. This is meant to separate objects of different types from one another, so that the sequence produced by one type may not then be loaded into another one, creating potential harm to application logic safety.
 * @method
 * @public
 * @returns {string} A string identifier of the sequence type. Should be unique for the particular type of object application-wide.
 */
CommitSequenceProducer.prototype.getSequenceType = function getSequenceType(){};

/**
 * Get events pending for saving.
 * @method
 * @public
 * @returns {module:esdf/core/Event~Event[]} An array of events to persist within the commit.
 */
CommitSequenceProducer.prototype.getNewEvents = function getNewEvents(){};

module.exports.CommitSequenceProducer = CommitSequenceProducer;