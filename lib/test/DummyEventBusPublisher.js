/**
 * @module esdf/test/DummyEventBusPublisher
 */

var QueueRouter = require('../utils/QueueRouter');

// AMQP look-alike.

//TODO: Documentation for this file.
/**
 * Construct a new DummyEventBusPublisher. A dummy publisher emulates per-consumer queue semantics and wildcard routing, similar to how AMQP works.
 */
//TODO: Pass the routing key builder dynamically in the constructor, instead of static function definition.
function DummyEventBusPublisher(){
	this._router = new QueueRouter();
}

DummyEventBusPublisher.prototype.buildRoutingKeyForEvent = function buildRoutingKeyForEvent(eventObject, commitObject){
	return commitObject.aggregateType + '.' + eventObject.eventType;
};

DummyEventBusPublisher.prototype.publishCommit = function publishCommit(commitObject){
	var events = commitObject.getEvents();
	events.forEach((function(event){
		this._router.publish(this.buildRoutingKeyForEvent(event, commitObject), {event: event, commit: commitObject});
	}).bind(this));
};

DummyEventBusPublisher.prototype.getRouter = function getRouter(){
	return this._router;
};

module.exports = DummyEventBusPublisher;
