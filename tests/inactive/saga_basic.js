var DummyEventSink = require('../DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate.js').EventSourcedAggregate;
//var EventStreamAdapter = require('../EventStreamAdapter.js').EventStreamAdapter;
var Event = require('../Event.js').Event;
var Saga = require('../Saga.js').Saga;
var tryWith = require('../utils').tryWith;
var when = require('when');
var assert = require('assert');


//TODO: fix the ARs and rewrite the main test logic

function SimpleOrder(){
	EventSourcedAggregate.call(this);
	this.purchased = false;
	this.on('OrderPurchased', function(eventEnvelope){
		console.log('Order purchased...');
		this.purchased = true;
	});
};
SimpleOrder.prototype = new EventSourcedAggregate();
SimpleOrder.prototype.purchase = function purchase(){
	if(!this.purchased){
		console.log('purchasing order...');
		this._stageEvent(new Event('OrderPurchased', {customerAddress: '123 Wayland street'}));
	}
	else{
		// Note: you do not have to include this "else" case. Doing nothing is fine, and ensures that SimpleOrder.purchase is *naturally idempotent*.
		//  However, for this test case, we choose to throw an exception instead, in order to ensure strictly controlled operations.
		throw new Error('Already purchased!');
	}
};
SimpleOrder.prototype.markAsDelivered = function markAsDelivered(deliveryID){
	this._stageEvent(new Event('OrderDelivered', {deliveryID: deliveryID}));
};

function SimpleDelivery(){
	EventSourcedAggregate.call(this);
	this.orderID = undefined;
	this.destinationAddress = undefined;
	this.on('DeliveryOrdered', function(eventPayload){
		console.log('SimpleDelivery: delivery has been ordered');
		this.orderID = eventPayload.orderID;
		this.destinationAddress = eventPayload.customerAddress;
	});
};
SimpleDelivery.prototype = new EventSourcedAggregate();
SimpleDelivery.prototype.orderDelivery = function orderDelivery(orderID, address){
	this._stageEvent(new Event('DeliveryOrdered', {orderID: orderID, customerAddress: address}));
};
SimpleDelivery.prototype.complete = function complete(){
	// This is an example of event enriching - orderID is set to a context-dependent property.
	this._stageEvent(new Event('DeliveryCompleted', {orderID: this.orderID}));
};

/**
 * A dummy saga. This particular saga works by reacting to OrderCompleted events and automatically starting a Delivery process.
 * Then, when the Delivery is completed, the originating order is marked as Delivered.
 */

function DeliverySaga(){
	this._states = {
		'_': {
			transitions: [
				{
					outputEventType: 'DeliverySagaDeliveryStarted',
					destination: 'AwaitingDelivery',
					requiredEvents: [{eventType: 'OrderPurchased'}],
					action: function startDeliveryService(purchaseEvent){
						return tryWith(this.eventSink, SimpleDelivery, ('delivery-for-' + purchaseEvent.AggregateID + ':' + purchaseEvent.commandID), function(deliveryAR){
							deliveryAR.orderDelivery(purchaseEvent.AggregateID, purchaseEvent.EventObject.customerAddress);
						},
						{
							commandType: 'DeliverySaga_startDelivery',
							commandID: purchaseEvent.commandID
						});
					}
				}
			]
		},
		'AwaitingDelivery': {
			transitions: [
				{
					outputEventType: 'DeliverySagaDeliveryCompleted',
					destination: 'DeliveryCompleted',
					requiredEvents: [{eventType: 'DeliveryCompleted'}],
					action: function markOrderAsDeliveredService(deliveryEvent){
						return tryWith(this.eventSink, SimpleOrder, deliveryEvent.EventObject.orderID, function(orderAR){
							orderAR.markAsDelivered(deliveryEvent.AggregateID);
						},
						{
							commandType: 'DeliverySaga_markOrderAsDelivered',
							commandID: deliveryEvent.EventID
						});
					}
				}
			]
		},
		'DeliveryCompleted': {
			// Final state. Nowhere to go.
			transitions: []
		}
	};
	
	// Call the "parent" constructor to properly initialize state.
	Saga.call(this);
};
DeliverySaga.prototype = new Saga();

// TODO: Create a DummyEventSource connector, so that events can be piped for testing.
// Actual test case starts here.
describe('Saga', function(){
	describe('#processEvent test', function(){
		it('should start a new delivery via SimpleDelivery event emission and then complete it via the saga', function(test_done){
			var sink = new DummyEventSink();
			var source = new EventStreamAdapter(sink);
			var deliveryBusinessProcess = new DeliverySaga();
			source.on('OrderPurchased', deliveryBusinessProcess.processEvent.bind(deliveryBusinessProcess));
			source.on('DeliveryCompleted', deliveryBusinessProcess.processEvent.bind(deliveryBusinessProcess));
			source.on('OrderDelivered', function(){test_done();});
			deliveryBusinessProcess.eventSink = sink;
			deliveryBusinessProcess.processEvent({
				eventType: 'OrderPurchased',
				AggregateID: 'order1',
				SequenceNumber: 1,
				commandID: 'purchase1',
				EventObject: {
					customerAddress: '123 Wayland Street'
				}
			}).then(function(result){
				if(!sink._streams['delivery-for-order1:purchase1'] || sink._streams['delivery-for-order1:purchase1'].length !== 1 || sink._streams['delivery-for-order1:purchase1'][0][0].eventType !== 'DeliveryOrdered'){
					return test_done(new Error('No relevant sunk commit found. Available streams: ' + Object.keys(sink._streams).join(', ')));
				}
				// Now that the delivery has started, we can complete it and expect the saga to act (we still need to pass the event to it, until a DummyEventSource is written by someone).
				tryWith(sink, SimpleDelivery, 'delivery-for-order1:purchase1', function(deliveryAR){
					deliveryAR.complete();
				},
				{
					commandType: 'completeDelivery',
					commandID: 'completeDelivery1'
				}).then(undefined, test_done);
			}, test_done);
		});
	});
});