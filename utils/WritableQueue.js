var when = require('when');
var EventEmitter = require('events').EventEmitter;
var QueueProcessor = require('./QueueProcessor').QueueProcessor;

function WritableQueue(processorFunction, processorOptions) {
	var self = this;
	self._pendingTasks = 0;
	self._maximumTasks = processorOptions.concurrencyLimit || 1;
	
	self._processorFunction = function(taskWrapper) {
		return when.try(processorFunction, taskWrapper.data).then(function() {
			self._pendingTasks -= 1;
			if (self._pendingTasks === 0) {
				self.emit('drain');
			}
			taskWrapper.callback();
		}, function(error) {
			self.emit('error', error);
			taskWrapper.callback(error);
		});
	};
	
	this._queue = new QueueProcessor(processorOptions);
	this._queue.setProcessorFunction(self._processorFunction);
	this._queue.start();
}
WritableQueue.prototype = Object.create(EventEmitter.prototype);

WritableQueue.prototype.write = function write(chunk, encoding, callback) {
	callback = callback || function() {};
	this._queue.push({ data: chunk, callback: callback });
	this._pendingTasks += 1;
	return this._pendingTasks < this._maximumTasks;
};

WritableQueue.prototype.end = function end(chunk, encoding, callback) {
	if (chunk) {
		this.write(chunk, encoding, callback);
	}
	
};

module.exports.WritableQueue = WritableQueue;
