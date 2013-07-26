/**
 * @module esdf/utils/QueueProcessor
 */

var when = require('when');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Construct a new QueueProcessor instance. A QueueProcessor is a tool for achieving the Serializer pattern - it allows pushing items from one side, while serially executing a provided function on the other, whether it is asynchronous (Promise-based) or synchronous.
 * Use a QueueProcessor when you need to make sure that subsequent work items are only processed when the previous ones have finished.
 * Pausing and starting can be used when you need to temporarily suspend processing for some reason (e.g. initially, because the processor function may not be ready yet).
 * 
 * @constructor
 * @static
 * @param {module:esdf/utils/QueueProcessor#ProcessorFunction} processorFunction The function used for processing. If asynchronous, must return a Promise/A-compliant promise.
 * @param {Object} [options] Additional settings to be applied to the queue processor.
 * @param {Object} [options.queue] An array-like queue object. Must support at least push(), shift(), and the length property. Having indexes is not required.
 * @param  {Boolean} [options.autostart] Whether to run the processor immediately after creating. By default, explicit activation via the start() method is required.
 * @param {module:esdf/utils/QueueProcessor#QueueProcessingErrorLabeler} [options.errorLabelFunction] A function that will be used for labeling errors when they occur.
 * @param {Number} [options.concurrencyLimit]
 */
function QueueProcessor(processorFunction, options){
	if(!options){
		options = {};
	}
	// Initialize the queue using the provided constructor (Array by default).
	this._queue = typeof(options.queueConstructor) === 'function' ? (new options.queueConstructor()) : (new Array());
	// Set starting flags. By default, we are not processing at construction time.
	this._processing = false;
	this._paused = typeof(options.autostart) !== 'undefined' ? !(options.autostart) : true;
	this._errorLabelFunction = typeof(options.errorLabelFunction) === 'function' ? options.errorLabelFunction : function(workItem, error){};
	this._processorFunction = processorFunction;
	this._activeWorkers = 0;
	this._concurrencyLimit = typeof(options.concurrencyLimit) === 'number' ? options.concurrencyLimit : 1;
};
util.inherits(QueueProcessor, EventEmitter);

//TODO: document all these methods!

QueueProcessor.prototype._process = function _process(processorFunction){
	// Check for an end condition. If we have reached the queue's end, or the execution is paused, halt the recursion.
	if(this._paused || this._queue.length < 1){
		if(this._activeWorkers === 0){
			this._processing = false;
		}
		return false;
	}
	// Check if the concurrency limit is not exhausted - if it is, just stop and let other "threads" resume processing.
	if(this._activeWorkers >= this._concurrencyLimit){
		return false;
	}
	var currentWorkItem = this._queue.shift();
	++this._activeWorkers;
	// Call the processor function. On promise-or-value resolution, recurse into _process again (it will get the next element then).
	setImmediate((function(){
		// Create a function to be called when this item's processing finishes - its task will be to start processing the next item when ready.
		var continueProcessing = (function(){
			--this._activeWorkers;
			this._process(processorFunction);
		}).bind(this);
		var processError = (function(error){
			this._processError(currentWorkItem, error, continueProcessing);
		}).bind(this);
		when(this._processorFunction(currentWorkItem), continueProcessing, processError);
	}).bind(this));
	return true;
};

QueueProcessor.prototype._processError = function _processError(workItem, error, resumeCallback){
	// Use the stored, user-supplied function to label the work item with the encountered error.
	this._errorLabelFunction(workItem, error);
	// Requeue the item at the back of the queue, so that it may be processed later.
	this.push(workItem);
	resumeCallback();
};

QueueProcessor.prototype._maintainWorkerCount = function _maintainWorkerCount(){
	// If not processing and not paused, i.e. awaiting an item to process, start the processing.
	if(!this._paused){
		// Spin up as many threads as allowed by the concurrency limit, compensating for the already-running threads.
		//  Note that this may very well run 0 times, in case we are fully spun up.
		var taskWasStarted;
		do{
			taskWasStarted = this._process(this._processorFunction);
		}
		while(taskWasStarted);
	}
};

QueueProcessor.prototype.push = function push(item){
	// Immediately enqueue the item.
	this._queue.push(item);
	this._maintainWorkerCount();
};

QueueProcessor.prototype.start = function start(){
	if(typeof(this._processorFunction) !== 'function'){
		throw new Error('Before starting the queue processor, a processor function must be set!');
	}
	this._paused = false;
	this._maintainWorkerCount();
};

QueueProcessor.prototype.pause = function pause(){
	this._paused = true;
};

QueueProcessor.prototype.setProcessorFunction = function setProcessorFunction(processorFunction){
	this._processorFunction = processorFunction;
};

// Make JSDoc happy - define the processor function type.
/**
 * Function type used for processing enqueued items.
 * Processing other items does not occur until the function either returns a normal value, or a promise that it returned is resolved.
 * If not using promises, the function may also throw an exception to signal processing failure.
 * 
 * @callback module:esdf/utils/QueueProcessor#ProcessorFunction
 * @function
 * @param workItem The item, taken from the queue, to be processed.
 * @returns {external:Promise} A promise when asynchronous work is involved.
 * @returns Any other type when only a simple, synchronous (blocking) operation is performed on the item.
 * @throws {Error} Anything (preferably an Error object) when an error is encountered.
 */

module.exports.QueueProcessor = QueueProcessor;