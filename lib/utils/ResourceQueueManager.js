var when = require('when');
var QueueProcessor = require('./QueueProcessor');

/**
 * A ResourceQueueManager is a component which runs task functions for resources, ensuring that for any given resource, only one task is executing.
 * Order of execution is preserved relative to the order of task addition within a given resource.
 * @constructor
 * @param {Object} [options] - Optional settings for the queue manager.
 * @param {Object} [options.retryDelay] - A delay to apply before retrying a failed task for a resource. The delay only applies within one resource - that is, tasks for other resources are not delayed in any way.
 */
function ResourceQueueManager(options) {
	/**
	 * A map of queues, keyed by resourceID.
	 * @type {Object.<string,module:esdf/utils/QueueProcessor~QueueProcessor>}
	 */
	this._queues = Object.create(null);
	this._options = options || {};
}


/**
 * Run a given task function, assigned to a particular resource ID. The task will only be run after all previous tasks for this resourceID have completed.
 * Only one task for a resourceID can be executing (be in an unresolved state) at any time.
 * A task is considered to have completed when the promise-or-value it returns has been fulfilled.
 * @param {string} resourceID - The identifier of the execution queue to which the task shall be appended.
 * @param {function} task - A function to enqueue execution of. Should return a promise or a non-promise value. If a promise is returned, the queue waits for it to fulfill before progressing to the next task. If the task fails (throws or rejects), it is immediately retried until it succeeds.
 * @returns {Promise} A promise which fulfills when the task has succeeded. Will never reject, as the task may be retried an infinite number of times.
 */
ResourceQueueManager.prototype.run = function run(resourceID, task) {
	var self = this;
	// Ensure that the queue for our resource exists:
	if (!self._queues[resourceID]) {
		self._queues[resourceID] = new QueueProcessor({ concurrencyLimit: 1 });
		self._queues[resourceID].pendingTasksForResource = 0;
		self._queues[resourceID].setProcessorFunction(function(taskContainer) {
			function tryTask() {
				return when.try(taskContainer.task).then(function() {
					self._queues[resourceID].pendingTasksForResource -= 1;
					if (self._queues[resourceID].pendingTasksForResource <= 0) {
						self._queues[resourceID].pause();
						delete self._queues[resourceID];
					}
				}).then(taskContainer.fulfill, function(error) {
					if (!self._options.retryDelay) {
						return tryTask();
					}
					else {
						return when.resolve().delay(self._options.retryDelay).then(tryTask);
					}
				});
			}
			
			return tryTask();
			
		});
		self._queues[resourceID].start();
	}
	
	return when.promise(function(fulfill, reject) {
		self._queues[resourceID].pendingTasksForResource += 1;
		self._queues[resourceID].push({
			task: task,
			fulfill: fulfill,
			reject: reject
		});
	});
};

module.exports = ResourceQueueManager;
