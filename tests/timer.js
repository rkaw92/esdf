var Timer = require('../Timer.js').Timer;
var assert = require('assert');

describe('Timer', function(){
	describe('#create', function(){
		it('should create a new timer', function(){
			var timer = new Timer();
			timer.create('Test', new Date(), {});
			assert(timer._created);
			assert(!timer._fired);
		});
		it('should skip timer creation on an existing timer', function(){
			var timer = new Timer();
			timer.create('Test', new Date(), {});
			var startingEventCount = timer._stagedEvents.length;
			timer.create('Test', new Date(), {});
			var finalEventCount = timer._stagedEvents.length;
			assert(timer._created);
			assert.equal(startingEventCount, finalEventCount);
		});
	});
	describe('#fire', function(){
		it('should fire the timer', function(){
			var timer = new Timer();
			timer.create('Test', new Date(), {});
			assert(!timer._fired);
			timer.fire();
			assert(timer._fired);
		});
		it('should not fire the timer twice', function(){
			var timer = new Timer();
			timer.create('Test', new Date(), {});
			timer.fire();
			var startingEventCount = timer._stagedEvents.length;
			timer.fire();
			var finalEventCount = timer._stagedEvents.length;
			assert(timer._fired);
			assert.equal(startingEventCount, finalEventCount);
		});
		it('should properly expose the original metadata, as well as the A.I., in the fired event', function(){
			var timer = new Timer();
			timer.create('Test', new Date(), {
				sagaType: 'ExampleSaga',
				sagaID: 'SAGA-1'
			});
			timer.fire();
			var firingEvent = timer._stagedEvents[timer._stagedEvents.length - 1];
			assert.strictEqual(firingEvent.eventPayload.timerMetadata.sagaType, 'ExampleSaga');
			assert.strictEqual(firingEvent.eventPayload.timerMetadata.sagaID, 'SAGA-1');
			assert.strictEqual(firingEvent.eventPayload.applicationIdentifier, 'Test');
		});
	});
});