/**
 * @module esdf/utils/TaskQueue
 */

var EventEmitter = require('events').EventEmitter;
//TODO: documentation

function TaskQueue(options){
	this.queue = (options.queue && typeof(options.queue.push) === 'function' && typeof(options.queue.pull) === 'function') ? options.queue : new Queue.DelayedShiftArrayQueue();
	this.parallelCount = options.parallel_count ? options.parallel_count : 1;
	/**
	 * An array of tasks in flight (already dispatched to workers). Needs random access to //TODO
	 * @private
	 */
	this.currentlyProcessing = [];
};
TaskQueue.prototype = new EventEmitter();

TaskQueue.prototype.push = function push(task, options){
	
};