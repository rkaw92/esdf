/**
 * @module esdf/utils/SnapshotStrategy
 */

// Note: this file contains function factories. They are not constructors (although calling them with "new" would not do harm) nor do they produce objects.

/**
 * This strategy will attempt to save a snapshot every N commits, starting from commit number N.
 * @param {number} numberOfCommits N (the number of commits to allow before doing another snapshot). A snapshot is generated when the saved commit's slot number modulo N equals zero.
 */
module.exports.every = function every(numberOfCommits){
	return function everySnapshotStrategy(commit){
		// Commits start from 1, so there will not be any unnecessary snapshots when the commit list length is lower than N.
		return (commit.sequenceSlot % numberOfCommits === 0);
	};
};