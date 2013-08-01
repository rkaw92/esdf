/**
 * @module esdf/test/DummyEventSinkStreamer
 */

//TODO: module documentation
var EventEmitter = require('events').EventEmitter;
var when = require('when');

function DummyEventSinkStreamer(dummyEventSink){
	this._sinkDispatchQueue = dummyEventSink.dispatchQueue;
}
DummyEventSinkStreamer.prototype = new EventEmitter();

DummyEventSinkStreamer.prototype.setPublisher = function setPublisher(publisher){
	if(typeof(publisher.publishCommit) !== 'function'){
		throw new Error('The publisher needs to have a publishCommit method!');
	}
	return this._sinkDispatchQueue.setProcessorFunction(publisher.publishCommit.bind(publisher));
};

DummyEventSinkStreamer.prototype.start = function start(){
	return this._sinkDispatchQueue.start();
};

DummyEventSinkStreamer.prototype.pause = function pause(){
	return this._sinkDispatchQueue.pause();
};

module.exports.DummyEventSinkStreamer = DummyEventSinkStreamer;