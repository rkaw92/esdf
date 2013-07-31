/**
 * @module esdf/test/DummyEventPublisher
 */

var QueueRouter = require('./utils/QueueRouter.js').QueueRouter;

// AMQP look-alike.

/**
 * Construct a new DummyEventPublisher. A dummy publisher emulates per-consumer queue semantics and wildcard routing, similar to how AMQP works.
 */
//TODO: pass the routing key builder dynamically in the constructor, instead of static function definition
function DummyEventPublisher(router){
	this._router = router;
}

DummyEventPublisher.prototype.buildRoutingKeyForEvent = function buildRoutingKeyForEvent(eventObject){
	return eventObject.eventType;
};

DummyEventPublisher.prototype.publishCommit = function publishCommit(commitObject){
	var events = commitObject.getEvents();
	events.forEach((function(event){
		this._router.publish(this.buildRoutingKeyForEvent(event), {
			event: event,
			commit: commitObject
		});
	}).bind(this));
};

module.exports.DummyEventPublisher = DummyEventPublisher;