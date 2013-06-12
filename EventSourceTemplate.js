/**
 * @module esdf/core/createReadStream
 */

/**
 * Initializes default parameter values, accepts a queueing strategy, and creates an event emitter which defines pausing/resuming using the strategy, before calling stream_initializer_callback.
 * This function should be used for creating read-side event listeners, like this: createReadStream(some_options, ReadStreamConstructorFunction).
 * 
 * @memberof module:esdf/core/createReadStream
 * @param {object} options Options to use when creating the read stream template. Supported options: search_parameters (DB-dependent format), delegation_function, event_emitter. Other options may be required/accepted by the underlying event source.
 * @param {function} stream_initializer_callback The callback to run after creating the pausable/resumable event emitter. This callback will receive the options and the created emitter for producing events.
 * @returns {EventEmitter} An event emitter which will emit events of the same name as the received events (with the payload as the first argument to emit()).
 * @throws {Error} If options.event_emitter does not implement all of these methods: emit, on.
 */
function createReadStream(options, stream_initializer_callback){
	options = shallowCopy(options);
	options.search_parameters = (options.search_parameters) ? shallowCopy(options.search_parameters) : {};
	//Fallbacks for delegation functions - used to replace the defaults.
	//The "fast" variant should be fast indeed - it is used when iterating through events. Since events are (usually) loaded serially, any delay here will decrease the read throughput.
	options.delegation_function_fast = (options.delegation_function_fast) ? options.delegation_function_fast : setImmediate;
	//For a lower CPU usage, set delegation_function to something like function(callback){setTimeout(callback, 100);}. This will also result in a slower response time, so mind your QoS!
	options.delegation_function = (options.delegation_function) ? options.delegation_function : options.delegation_function_fast;
	
	//The EventEmitter is given out to the consumer (it *is* the event-reading stream!).
	var ev = (options.event_emitter) ? options.event_emitter : new (require('events').EventEmitter);
	if(!ev.emit || !ev.on){
		throw new Error('EventEmitter');
	}
	//Initially, we are in a running state. If "running" is set to false, the event source will wait with subsequent data pushes until resumed.
	//NOTE: It is not guaranted that, immediately after pause(), data will stop appearing. The source may choose to finish the current event batch first.
	ev.running = true;
	ev.next_callback = null;
	
	function makeDelegationWrapper(local_delegation_function, name){
		function wrapped(callback){
			next_callback = callback;
			if(this.running){ //"this" should point to the object the method is bound to - in this case, the event emitter (see assignments to ev.* below).
				local_delegation_function(next_callback);
			}
			else{
				this.emit('paused');
			}
			//If we are paused (!running), let the event emitter's resume() method call soon().
		};
		wrapped.funcname = name;
		return wrapped;
	};
	
	ev.soon = makeDelegationWrapper(options.delegation_function, 'soon');
	ev.verySoon = makeDelegationWrapper(options.delegation_function_fast, 'verySoon');
	
	//Assign pause/resume methods to the event emitter, so that the querying can be halted whenever required.
	ev.pause = function pause(){
		running = false;
	};
	ev.resume = function resume(){
		running = true;
		this.emit('resumed');
		soon(next_callback);
	};
	
	stream_initializer_callback(options, ev);
	
	return ev;
};

/**
 * Helper function, used for copying objects used as function arguments that are then turned e.g. into search parameters.
 * 
 * @param {object} obj The object of which a 1-level-deep copy is desired.
 * @returns {object} The copy.
 */
function shallowCopy(obj){
	var ret = {};
	for(var k in obj){
		ret[k] = obj[k];
	}
	return ret;
}

module.exports.createReadStream = createReadStream;