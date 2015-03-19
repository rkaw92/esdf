/**
 * @module esdf/utils/Trace
 */

var uuid = require('uuid');

var instanceUUID = uuid.v1();
var contextNumber = 0;

function getOccurenceConstructor(origin){
	contextNumber += 1;
	var contextID = (instanceUUID + ':' + contextNumber);

	function Occurence(type, data){
		if(!(this instanceof Occurence)){
			return new Occurence(type, data);
		}
		this.origin = origin;
		this.type = type;
		this.data = data;
		this.contextID = contextID;
	}
	
	return Occurence;
}

function Trace(initialOccurences, bufferSize){
	if(!(this instanceof Trace)){
		return new Trace(initialOccurences, bufferSize);
	}
	// By default, we never clean up trace entries when new ones appear. This is the least confusing behaviour.
	bufferSize = bufferSize || Infinity;
	// Assign the occurences object from the initial value - make sure we're not going to modify the original:
	// slice(-bufferSize) is used to only leave the desired number of items at maximum.
	var occurences = Array.isArray(initialOccurences) ? initialOccurences.slice(-bufferSize) : [];
	// Make sure that nobody can alter the occurences that we are going to store by proxying accesses to them:
	Object.defineProperty(this, 'occurences', {
 		configurable: false,
 		enumerable: true,
		get: function get(){
			// By using slice, the array itself is non-modifiable. Remember that the occurences' data may still be mutable, though. We can only do so much.
			return occurences.slice();
		},
	});
	// Also make available a function to register new occurences in a safe way (having discarded a previous entry if it had seemed too "old" to remember):
	this.add = function add(occurence){
		if(occurences.length >= bufferSize){
			bufferSize.shift();
		}
		occurences.push(occurence);
	};
}

module.exports.getOccurenceConstructor = getOccurenceConstructor;
module.exports.Trace = Trace;