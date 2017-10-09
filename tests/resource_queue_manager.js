var esdf = require('../index');
var ResourceQueueManager = esdf.utils.ResourceQueueManager;
var when = require('when');
var assert = require('assert');

describe('ResourceQueueManager', function() {
	it('should process tasks for the same resource sequentially, even in presence of errors', function() {
		var manager = new ResourceQueueManager({ retryDelay: 10 });
		// We will be creating functions that append something to an array for a given resource ID.
		var resourceMap = {};
		function taskFactory(resourceID, dataToAppend) {
			var failuresRemaining = Math.floor(Math.random() * 10);
			return function() {
				return when.resolve().delay(Math.random() * 20).then(function() {
					if (failuresRemaining > 0) {
						failuresRemaining -= 1;
						//console.log('fail %s -> %s', dataToAppend, resourceID);
						throw new Error('Artificial failure!');
					}
					if (!resourceMap[resourceID]) {
						resourceMap[resourceID] = [];
					}
					resourceMap[resourceID].push(dataToAppend);
					//console.log('push %s -> %s', dataToAppend, resourceID);
				});
			};
		}

		return when.all([
			manager.run('A', taskFactory('A', 0)),
			manager.run('A', taskFactory('A', 1)),
			manager.run('B', taskFactory('B', 0)),
			manager.run('A', taskFactory('A', 2)),
			manager.run('C', taskFactory('C', 0)),
			manager.run('B', taskFactory('B', 1)),
		]).then(function() {
			// Check whether execution order was preserved, i.e. if head-of-line blocking works within each resourceID.
			assert.deepEqual(resourceMap, {
				A: [ 0, 1, 2 ],
				B: [ 0, 1 ],
				C: [ 0 ]
			});
			// Also verify that queues are promptly removed, to avoid unnecessary memory pressure.
			assert.equal(Object.keys(manager._queues).length, 0);
		});
	});
	it('should support a custom logger function', function() {
		var logger;
		var logPromise = when.promise(function(fulfill) {
			logger = function(resourceID, error) {
				if (resourceID === 'A' && error.message === 'This is an expected failure, don\'t panic!') {
					fulfill();
				} else {
					reject(error);
				}
			};
		});
		var manager = new ResourceQueueManager({ retryDelay: 10, logger: logger });
		manager.run('A', function fail() {
			throw new Error('This is an expected failure, don\'t panic!');
		});
		return logPromise;
	});
});
