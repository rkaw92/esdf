var when = require('when');
var QueueProcessor = require('./QueueProcessor').QueueProcessor;
var Writable = require('stream').Writable;

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
			return taskWrapper.callback();
		}, function(error) {
			self.emit('error', error);
			return taskWrapper.callback(error);
		});
	};
	
	Writable.call(self, {
		objectMode: true
	});
	
	this._queue = new QueueProcessor(processorOptions);
	this._queue.setProcessorFunction(self._processorFunction);

	this._queue.start();
}
WritableQueue.prototype = Object.create(Writable.prototype);

WritableQueue.prototype._write = function write(chunk, encoding, callback) {
	callback = callback || function() {};
	this._queue.push({ data: chunk, callback: callback });
	this._pendingTasks += 1;
	return this._pendingTasks < this._maximumTasks;
};

WritableQueue.prototype._end = function end(chunk, encoding, callback) {
	if (chunk) {
		this.write(chunk, encoding, callback);
	}
};

module.exports.WritableQueue = WritableQueue;
