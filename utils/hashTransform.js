/**
 * @module esdf/utils/hashTransform
 */
var crypto = require('crypto');

/**
 * Helper function. Takes a commandID (or any string, really) and a key and returns a transformed commandID.
 * The hash function should be acyclic (and probably is).
 * Used in tryWith as the default transformation function.
 * 
 * @param {String} input The input ID to transform.
 * @param {String} transformKey The key to apply to the input.
 */
function hashTransform(input, transformKey){
	// Use MD5 - may not be very collision-resistant, but it should do for simple collision avoidance.
	var hasher = crypto.createHash('md5');
	hasher.update(input + '|' + transformKey, 'utf8');
	return hasher.digest('hex').toLowerCase();
}

module.exports.hashTransform = hashTransform;