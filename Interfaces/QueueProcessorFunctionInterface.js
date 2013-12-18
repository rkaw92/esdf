/**
 * @module esdf/interfaces/QueueProcessorFunctionInterface
 */
/**
 * Function type used for processing enqueued items.
 * Processing other items does not occur until the function either returns a normal value, or a promise that it returned is resolved/rejected.
 * On rejection, the work item is re-queued to the back of the queue. If you want to get rid of the item from the queue, resolve the promise (possibly after writing the work item / error to an error queue...).
 * If not using promises, the function may also throw an exception to signal processing failure (treated the same as promise rejection).
 * @function
 * @interface
 * @abstract
 * @name module:esdf/interfaces/QueueProcessorFunctionInterface
 * @param workItem The item, taken from the queue, to be processed.
 * @returns {external:Promise} A promise when asynchronous work is involved.
 * @returns Any other type of value when only a simple, synchronous (blocking) operation is performed on the item.
 * @throws {Error} Anything (preferably an Error object) when an error is encountered.
 */