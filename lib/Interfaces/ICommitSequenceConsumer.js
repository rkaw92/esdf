/**
 * This interface specifies the behaviour of a commit sequence consumer - an object which accepts and processes sequences of numbered commits (event batches), one by one.
 * @interface
 */
function ICommitSequenceConsumer(){};

/**
 * Get the next sequence number that the consumer expects to see.
 * @method
 * @public
 * @returns {Number} The next expected sequence number.
 */
ICommitSequenceConsumer.prototype.getNextSequenceNumber = function getNextSequenceNumber(){};

/**
 * Process ("consume") a commit.
 * @method
 * @public
 * @param {ICommit} commit The commit to process.
 * @returns {(Promise.<ICommitSequenceConsumer>|ICommitSequenceConsumer)} The called method's owner ("this") or a promise which shall yield it.
 */
ICommitSequenceConsumer.prototype.processCommit = function processCommit(){
	
};