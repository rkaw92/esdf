var crypto = require('crypto');

/**
 * Create a name-based UUID (v5), derived from the identifier. Such an UUID is deterministic.
 * This is useful, for example, when operating on aggregates in reaction to events - to ensure idempotence, creation of new resources
 *  needs to occur under certain pre-defined UUIDs instead of random ones. Otherwise, garbage items could be created in case
 *  the reaction is run a few times and different aggregate IDs are generated and then operated on.
 * @function
 * @param {string} namespace The namespace UUID. It is completely valid to simply generate, for example, a v4 UUID and use it as the namespace UUID -
 *  just make sure that the same UUID is used when deriving the ID for the same purpose. Different namespaces will produce
 *  different UUIDs (with a very high probability), even given the same input name.
 * @param {string} name Name (or original ID) of the resource for which a UUID should be generated.

 * @returns {string} The UUID derived in a deterministic and repeatable way from the original name/namespace combination.
 */
module.exports.deriveUUID = function deriveUUID(namespace, name){
	return uuidv5({
		data: name,
		ns: namespace
	});
};

// Function copied from https://github.com/OrangeDog/node-uuid/blob/master/uuid.js
function hashUUID(hashFn, options, buffer, offset) {
	var i, v;
	var output = buffer || new Buffer(16);
	offset = offset || 0;
	options = options || {};

	if (!options.data) {
		for (i=0; i<16; i++) {
			output[i] = 0;
		}
		return buffer || unparse(output);
	}

	if (typeof options.ns === 'string') {
		options.ns = parse(options.ns, new Buffer(16));
	}

	var hasher = crypto.createHash(hashFn);
	hasher.update(options.ns || '');
	hasher.update(options.data || '');

	switch (hashFn) {
		case 'md5': v = 0x30; break;
		case 'sha1': v = 0x50; break;
	}
	output.write(hasher.digest('binary'), offset, 16, 'binary');
	output[offset + 8] = output[offset + 8] & 0x3f | 0x80; // set variant
	output[offset + 6] = output[offset + 6] & 0x0f | v; // set version

	return buffer || unparse(output);
}

function uuidv5(options, buffer, offset){
	return hashUUID('sha1', options, buffer, offset);
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
	var i = (buf && offset) || 0, ii = 0;

	buf = buf || [];
	s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
		if (ii < 16) { // Don't overflow!
			buf[i + ii++] = _hexToByte[oct];
		}
	});

	// Zero out remaining bytes if string was short
	while (ii < 16) {
		buf[i + ii++] = 0;
	}

	return buf;
}

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
	_byteToHex[i] = (i + 0x100).toString(16).substr(1);
	_hexToByte[_byteToHex[i]] = i;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
	var i = offset || 0, bth = _byteToHex;
	return  bth[buf[i++]] + bth[buf[i++]] +
					bth[buf[i++]] + bth[buf[i++]] + '-' +
					bth[buf[i++]] + bth[buf[i++]] + '-' +
					bth[buf[i++]] + bth[buf[i++]] + '-' +
					bth[buf[i++]] + bth[buf[i++]] + '-' +
					bth[buf[i++]] + bth[buf[i++]] +
					bth[buf[i++]] + bth[buf[i++]] +
					bth[buf[i++]] + bth[buf[i++]];
}