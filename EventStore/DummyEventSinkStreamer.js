/**
 * @module esdf/Test/DummyEventSinkStreamer
 */

var EventEmitter = require('events').EventEmitter;
var when = require('when');

/**
 * Construct a new DummyEventSinkStreamer. Such a streamer attaches to a DummyEventSink and publishes (dispatches) commits from its dispatch queue.
 * Since DummyEventSink lives entirely in memory, the streamer has no concept of persistence - it will simply stream all commits ever seen by the DummyEventSink instance.
 * Internally, it acts as a simple method proxy - it takes the sink's QueueProcessor and registers the publisher's publishCommit method as the worker on the queue.
 */
function DummyEventSinkStreamer(dummyEventSink){
	this._sinkDispatchQueue = dummyEventSink.dispatchQueue;
	this._publisherAssigned = false;
}

/**
 * Assign a publisher object whose publishCommit method will be called with every commit read.
 * @param {module:esdf/Interfaces/CommitPublisher} publisher The object to assign as the publishing worker.
 */
DummyEventSinkStreamer.prototype.setPublisher = function setPublisher(publisher){
	if(typeof(publisher.publishCommit) !== 'function'){
		throw new Error('The publisher needs to have a publishCommit method!');
	}
	this._publisherAssigned = true;
	return this._sinkDispatchQueue.setProcessorFunction(publisher.publishCommit.bind(publisher));
};

/**
 * Launch the streaming process. Requires a publisher to be assigned first by setPublisher.
 */
DummyEventSinkStreamer.prototype.start = function start(){
	if(this._publisherAssigned){
		return this._sinkDispatchQueue.start();
	}
	else{
		throw new Error('A publisher needs to be assigned to the DummyEventSinkStreamer before the dispatch can be started!');
	}
};

DummyEventSinkStreamer.prototype.pause = function pause(){
	return this._sinkDispatchQueue.pause();
};

module.exports.DummyEventSinkStreamer = DummyEventSinkStreamer;