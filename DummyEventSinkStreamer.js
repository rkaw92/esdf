/**
 * @module esdf/test/DummyEventSinkStreamer
 */

//TODO: module documentation
//TODO: reimplement using a generic queue function mapper with start-stop semantics
var EventEmitter = require('events').EventEmitter;
var QueueProcessor = require('utils/QueueProcessor.js').QueueProcessor;
var when = require('when');

function DummyEventSinkStreamer(dummyEventSink){
	this._sinkDispatchQueue = dummyEventSink.dispatchQueue;
}
DummyEventSinkStreamer.prototype = new EventEmitter();

DummyEventSinkStreamer.prototype.setDispatcher = function setDispatcher(dispatcher){
	if(typeof(dispatcher.dispatchCommit) !== 'function'){
		throw new Error('The dispatcher needs to have a dispatchCommit method!');
	}
	return this._sinkDispatchQueue.setProcessorFunction(dispatcher.dispatchCommit.bind(dispatcher));
};

DummyEventSinkStreamer.prototype.start = function start(){
	return this._sinkDispatchQueue.start();
};

DummyEventSinkStreamer.prototype.pause = function pause(){
	return this._sinkDispatchQueue.pause();
};

module.exports.DummyEventSinkStreamer = DummyEventSinkStreamer;