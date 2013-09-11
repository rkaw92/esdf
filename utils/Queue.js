/**
 * @module esdf/utils/Queue
 */

function DelayedShiftArrayQueue(options){
	//Handle the options and their default values.
	this.minShiftLength = options.min_shift_length ? options.min_shift_length : 100;
	this.delayFunction = (typeof(options.delay_function) === 'function') ? options.delay_function : function _defaultDelay(delayed_callback){delayed_callback();};
	//Initialize the backing array.
	this.backingStore = [];
	this.backingStoreOffset = 0;
}

Queue.prototype._reset = function _reset(){
	this.backingStore = this.backingStore.slice(this.backingStoreOffset, this.backingStore.length);
	this.backingStoreOffset = 0;
};

Queue.prototype.push = function push(element){
	this.backingStore.push(element);
};

Queue.prototype.pull = function pull(){
	if(this.backingStoreOffset < this.backingStore.length){
		var element = this.backingStore[this.backingStoreOffset];
		this.backingStoreOffset++;
		if(this.backingStoreOffset >= this.minShiftLength){
			this._reset();
		}
	}
	else{
		//No elements exist in the backing store that haven't been read yet.
		return undefined;
	}
};

module.exports.DelayedShiftArrayQueue = DelayedShiftArrayQueue;