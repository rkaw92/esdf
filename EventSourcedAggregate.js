var EventEmitter = require('events').EventEmitter;
var when = require('when');

function EventSourcedAggregate(){
	this.data = {};
	this.aggregateID = null;
	this.nextSequenceNumber = 1;
}
EventSourcedAggregate.prototype = new EventEmitter();

EventSourcedAggregate.prototype._emitActual = EventSourcedAggregate.prototype.emit;

EventSourcedAggregate.prototype.emit = function emit(event, params){
	var self = this;
	var emit_deferred = when.defer();
	when(self._eventSink.sink(event, self.aggregateID, self.nextSequenceNumber),
	function _event_sink_succeeded(result){
		self._emitActual(event, params);
		return emit_deferred.resolver.resolve(true);
	},
	function _event_sink_failed(reason){
		setImmediate(function(){ self._emitActual('_error', reason) });
		return emit_deferred.resolver.reject(reason);
	}); //this is a promise (thenable)
	return emit_deferred.promise;
};

EventSourcedAggregate.prototype.run = function run(method, args, limit){
	//default params
	limit = (typeof(limit) === 'number') ? limit : Infinity;
	var self = this;
	var run_deferred = when.defer();
	var runs_already_done = 0;
	function _retryActual(){
		when(method.apply(self, args),
		function _retryActualSucceeded(result){
			run_deferred.resolver.resolve(result);
		},
		function _retryActualFailed(reason){
			self.once('_reloaded', function(){
				if(runs_already_done < limit){
					setImmediate(_retryActual); //don't pollute the stack - push the retry to the next iteration
					++runs_already_done;
				}
				else{
					run_deferred.resolver.reject(reason);
				}
			});
		});
	};
	_retryActual();
	return run_deferred.promise;
};

module.exports = EventSourcedAggregate;