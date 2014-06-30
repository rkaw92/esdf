var SagaLib = require('../Saga.v2');
var Saga = SagaLib.Saga;
var SagaStage = SagaLib.SagaStage;
var SagaTransition = SagaLib.SagaTransition;
var esdf = require('../index');
var Event = esdf.core.Event;
var Commit = esdf.core.Commit;
var tryWith = esdf.utils.tryWith;
var util = require('util');
var when = require('when');
var assert = require('assert');

var sink = new esdf.test.DummyEventSink();
var streamer = new esdf.test.DummyEventSinkStreamer(sink);
var loader = esdf.utils.createAggregateLoader(sink);
var saver = sink.sink.bind(sink);

function OrderSaga(){
	var initialStage = new SagaStage('init', ['OrderIssued']);
	var completedStage = new SagaStage('completed', []);
	initialStage.addTransition((new SagaTransition('orderCompletion',
	function _eventEndsTransition(event, commit, queuedEvents, accumulator){
		return true;
	},
	function _transitionAction(event, commit, queuedEvents, accumulator){
		return when.resolve();
	},
	'OrderCompleted',
	function(event, commit, queuedEvents, accumulator, actionResult){
		return {
			orderID: commit.sequenceID
		};
	})).setDestination(completedStage));
	this._init(initialStage);
}
util.inherits(OrderSaga, Saga);

describe('Saga', function(){
	describe('#new', function(){
		it('should construct a new Saga object', function(){
			var testSaga = new OrderSaga();
			assert(testSaga._currentStage);
		});
	});
	describe('#processEvent', function(){
		it('should react to the event and perform a transition', function(done){
			// Set the publisher to a function which completes the test when the saga transitions, emitting an OrderCompleted event.
			streamer.setPublisher({
				publishCommit: function(commit){
					commit.events.forEach(function(event){
						if(event.eventType === 'OrderCompleted'){
							done();
						}
					});
				}
			});
			streamer.start();
			tryWith(loader, saver, OrderSaga, 'testSaga', function(saga){
				var orderEvent = new Event('OrderIssued', {amount: 123.00});
				var orderCommit = new Commit([orderEvent], 'order123', 1, 'Order');
				return saga.processEvent(orderEvent, orderCommit);
			}); // end of "tryWith" callback
		});
	});
});