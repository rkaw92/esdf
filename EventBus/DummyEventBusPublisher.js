/**
 * @module esdf/Test/DummyEventBusPublisher
 */

var QueueRouter = require('../utils/QueueRouter.js').QueueRouter;

// AMQP look-alike.

/**
 * Construct a new DummyEventBusPublisher. A dummy publisher emulates per-consumer queue semantics and wildcard routing, similar to how AMQP works.
 */
//TODO: pass the routing key builder dynamically in the constructor, instead of static function definition
function DummyEventBusPublisher(){
	this._router = new QueueRouter();
}

DummyEventBusPublisher.prototype.buildRoutingKeyForEvent = function buildRoutingKeyForEvent(eventObject){
	return eventObject.eventType;
};

DummyEventBusPublisher.prototype.publishCommit = function publishCommit(commitObject){
	var events = commitObject.getEvents();
	events.forEach((function(event){
		this._router.publish(this.buildRoutingKeyForEvent(event), {event: event, metadata: commitObject.getMetadata()});
	}).bind(this));
};

DummyEventBusPublisher.prototype.getRouter = function getRouter(){
	return this._router;
};

module.exports.DummyEventBusPublisher = DummyEventBusPublisher;