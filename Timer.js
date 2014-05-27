/**
 * @module esdf/core/Timer
 */

var EventSourcedAggregate = require('./EventSourcedAggregate').EventSourcedAggregate;
var Event = require('./Event').Event;
var util = require('util');

/**
 * An aggregate representing a timer. A timer is a simple object with only two behaviours - creation and firing.
 * An external component is responsible for creating and firing timers at the appropriate time.
 * @constructor
 * @extends esdf/core/EventSourcedAggregate~EventSourcedAggregate
 */
function Timer(){
	this._created = false;
	this._fired = false;
	this._fireAt = null;
	this._applicationIdentifier = '';
	this._timerMetadata = {};
}
util.inherits(Timer, EventSourcedAggregate);
Timer.prototype._aggregateType = 'Timer';

Timer.prototype.onTimerCreated = function onTimerCreated(event){
	this._created = true;
	this._fireAt = new Date(event.eventPayload.fireAt);
	this._timerMetadata = event.eventPayload.timerMetadata;
	this._applicationIdentifier = event.eventPayload.applicationIdentifier;
};

Timer.prototype.onTimerFired = function onTimerFired(event){
	this._fired = true;
};

Timer.prototype.create = function create(applicationIdentifier, fireAt, timerMetadata){
	if(this._created){
		return;
	}
	this._stageEvent(new Event('TimerCreated', {
		applicationIdentifier: applicationIdentifier,
		fireAt: new Date(fireAt),
		timerMetadata: timerMetadata || {}
	}));
};

Timer.prototype.fire = function fire(){
	if(this._fired){
		return;
	}
	this._stageEvent(new Event('TimerFired', {}));
};

Timer.prototype._enrichEvent = function _enrichEvent(event){
	if(event.eventType === 'TimerFired'){
		event.eventPayload.timerMetadata = this._timerMetadata;
		event.eventPayload.applicationIdentifier = this._applicationIdentifier;
	}
};

module.exports.Timer = Timer;