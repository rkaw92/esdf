/**
 * @module esdf/types/CommitStream
 */

var TransformStream = require('stream').Transform;
var ReadableStream = require('stream').Readable;
var when = require('when');

/**
 * A CommitStream is essentially a stream that produces single commits.
 * It uses a Promise-based function that, upon calling, should return a Promise for an array of Commit objects.
 * @param {(function(sequenceID, sequenceSlot):Promise.<module:esdf/core/Commit[]>|external:ReadableStream)} reader - The function to use for reading commits, or, alternatively, an existing ReadableStream that works in object mode and produces arrays ("batches") of commits.
 */
function CommitStream(reader, sequenceID, start) {
	if (!start) {
		// Commit numbers begin from 1, not 0:
		start = 1;
	}
	var currentOffset = start;
	
	var readable;
	
	if (typeof reader === 'function') {
		// If a function was passed, wrap it in a ReadableStream:
		readable = new ReadableStream({ objectMode: true });
		readable._read = function _read(length) {
			var self = this;
			when.try(reader, sequenceID, currentOffset).then(function(commits) {
				if (!Array.isArray(commits) && commits !== null) {
					throw new Error('Expected an array of Commit objects, but got an unknown type from the commit reader function');
				}
				// Only perform one push(). Multiple pushes from one _read() are apparently a sure-fire way to cause a huge memory leak.
				self.push(commits);
			}).catch(function(error) {
				self.emit('error', error);
			});
		};
	}
	else if (typeof reader === 'object' && reader !== null && typeof reader.read === 'function') {
		// The reader looks like a ready-made ReadableStream:
		readable = reader;
	}
	
	TransformStream.call(this, { objectMode: true });
	// Immediately pipe the stream of commit batches that comes from the readable stream through ourselves:
	readable.pipe(this);
}
CommitStream.prototype = Object.create(TransformStream.prototype);

CommitStream.prototype._transform = function _transform(chunk, encoding, callback) {
	// We make each commit a separate "chunk", so that the stream consumer gets them one by one.
	chunk.forEach(function(commit) {
		this.push(commit);
	}, this);
	callback();
};

module.exports.CommitStream = CommitStream;
