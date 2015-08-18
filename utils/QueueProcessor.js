/**
 * @module esdf/utils/QueueProcessor
 */

var when = require('when');
var util = require('util');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * Construct a new QueueProcessor instance. A QueueProcessor is a tool for achieving the Serializer pattern - it allows pushing items from one side, while serially executing a provided function on the other, whether it is asynchronous (Promise-based) or synchronous.
 * Use a QueueProcessor when you need to make sure that subsequent work items are only processed when the previous ones have finished.
 * Pausing and starting can be used when you need to temporarily suspend processing for some reason (e.g. initially, because the processor function may not be ready yet).
 * 
 * @constructor
 * @param {Object} [options] Additional settings to be applied to the queue processor.
 * @param {Object} [options.queue] An array-like queue object. Must support at least push(), shift(), and the length property. Having indexes is not required.
 * @param {module:esdf/utils/QueueProcessor#ProcessorFunction} [options.processorFunction] The processor function to use initially. If left out, no function will be assigned and one must be set afterwards, before starting processing.
 * @param {Boolean} [options.autostart] Whether to run the processor immediately after creating. By default, explicit activation via the start() method is required. Obviously, this requires options.processorFunction to be provided, too.
 * @param {module:esdf/utils/QueueProcessor#QueueProcessingErrorLabeler} [options.errorLabelFunction] A function that will be used for labeling errors when they occur.
 * @param {Number} [options.concurrencyLimit] The number of processor functions that can be running "simultaneously" in a single Node thread. The function is not called (and the queue popped) until the worker number is lower than this.
 */
function QueueProcessor(options){
	if(!options){
		options = {};
	}
	// Initialize the queue using the provided constructor (Array by default).
	this._queue = typeof(options.queueConstructor) === 'function' ? (new options.queueConstructor()) : [];
	// Set starting flags. By default, we are not processing at construction time.
	this._processing = false;
	this._paused = true;
	this._errorLabelFunction = typeof(options.errorLabelFunction) === 'function' ? options.errorLabelFunction : function(workItem, error){};
	this._processorFunction = null;
	this._activeWorkers = 0;
	this._concurrencyLimit = typeof(options.concurrencyLimit) === 'number' ? options.concurrencyLimit : 1;
	if(options.processorFunction){
		this.setProcessorFunction(options.processorFunction);
	}
	if(options.autostart){
		this.start();
	}
	
	this._notifier = new EventEmitter2();
}

/**
 * Main queue processing function. Shifts ("pops") one element from the queue and schedules an execution of the processor function on it via setImmediate.
 *  If the processor function returns something other than a promise, another _process is called recursively. Otherwise, it is called when the promise resolves.
 *  If the promise is rejected instead of resolved, an error processing, user-specified routine (options.errorLabelFunction) is executed (the code does NOT wait for any promise resolutions from the error labeler),
 *  after which the work item is pushed to the queue's back again, to be processed in the near future (after any current events).
 * @private
 * @param {module:esdf/interfaces/QueueProcessorFunctionInterface} processorFunction The function to use when processing. Passed down to subsequent recursive _process calls, to preserve uniformity in face of changing function assignment in the meantime.
 */
QueueProcessor.prototype._process = function _process(processorFunction){
	// Check for an end condition. If we have reached the queue's end, or the execution is paused, halt the recursion.
	if(this._paused || this._queue.length < 1){
		if(this._activeWorkers === 0){
			this._processing = false;
			this._notifier.emit('WorkStopped');
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
			return this._process(processorFunction);
		}).bind(this);
		var processError = (function(error){
			return this._processError(currentWorkItem, error, continueProcessing);
		}).bind(this);
		processorFunction = processorFunction || this._processorFunction;
		return when.try(processorFunction, currentWorkItem).then(continueProcessing, processError);
	}).bind(this));
	return true;
};

QueueProcessor.prototype._processError = function _processError(workItem, error, resumeCallback){
	// Use the stored, user-supplied function to label the work item with the encountered error.
	this._errorLabelFunction(workItem, error);
	// Requeue the item at the back of the queue, so that it may be processed later.
	this.push(workItem);
	return resumeCallback();
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

/**
 * Add an element to the queue. Elements added last are processed last, in a FIFO manner.
 */
QueueProcessor.prototype.push = function push(item){
	// Immediately enqueue the item.
	this._queue.push(item);
	this._maintainWorkerCount();
};

/**
 * Start processing the elements by popping them off the stack and passing to the processor function.
 *  A processor function needs to have been set before start()ing.
 * Starting when already started has no further effect.
 */
QueueProcessor.prototype.start = function start(){
	if(typeof(this._processorFunction) !== 'function'){
		throw new Error('Before starting the queue processor, a processor function must be set!');
	}
	this._paused = false;
	this._maintainWorkerCount();
};

/**
 * Prevent any further elements from being popped off the queue and any processor functions from starting execution, until start()ed again.
 *  The result is thenable, which allows you to wait until all tasks in progress have been processed and the processing has ceased.
 *  Pausing when already paused has no further effect (when still pausing, many calls to pause() will result in many promises being returned, all of which will act correctly).
 * 
 * @returns {external:Promise} A promise that will be fulfilled when the processing ceases.
 */
QueueProcessor.prototype.pause = function pause(){
	this._paused = true;
	if(this._processing){
		return when.promise(function (resolve, reject) {
			this._notifier.once('WorkStopped', function _fulfillStopPromise(){
				return resolve();
			});
		});
	}
	else{
		// We are already stopped (not processing anything), so we may as well return an already-resolved promise.
		return when.resolve();
	}
};

/**
 * Set the function used for processing enqueued elements. The function shall get the element as its only argument.
 *  Its return (and the promise's resolution, if applicable) should mark that it is OK to pop another element off the queue and process it.
 * @param {module:esdf/interfaces/QueueProcessorFunctionInterface} processorFunction The function used for processing. If asynchronous, must return a Promises/A-compliant promise.
 */
QueueProcessor.prototype.setProcessorFunction = function setProcessorFunction(processorFunction){
	if(typeof(processorFunction) !== 'function'){
		throw new Error('QueueProcessor needs a function passed to setProcessorFunction, passed type:' + typeof(processorFunction));
	}
	this._processorFunction = processorFunction;
};

module.exports.QueueProcessor = QueueProcessor;