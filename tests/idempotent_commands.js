var DummyEventSink = require('../DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate').EventSourcedAggregate;
var when = require('when');
var assert = require('assert');
var tryWith = require('../utils').tryWith;

/**
 * In this test case, we examine the operation of a simple AR simulating a shopping cart. The cart has two operations: adding an item and completing the order.
 * When all desired (in this test: only one) items have been added, the order is completed and further modification attempts will fail.
 * However, when coupled with the smart service layer (tryWith), the completion can be called multiple times with the same contextual command ID and it should appear to yield the same result every time.
 */

function SimpleCart(){
	//NOTE: the line below is mandatory!
	EventSourcedAggregate.call(this);
	this.billTotal = 0.00;
	this.open = true;
	this.on('LineItemAdded', function(item){
		this.billTotal += item.price;
	});
	this.on('OrderCompleted', function(){
		this.open = false;
	});
};
SimpleCart.prototype = new EventSourcedAggregate();
SimpleCart.prototype.addItem = function(name, price){
	this.stage('LineItemAdded', {name: name, price: price});
};
SimpleCart.prototype.completeOrder = function(){
	if(this.open){
		this.stage('OrderCompleted');
		return this.billTotal;
	}
	else{
		throw new Error('Can not complete previously-completed orders!');
	}
};

describe('tryWith', function(){
	describe('#idempotency', function(){
		it('should manage to complete the cart order twice and receive the same total bill from both operations', function(testDone){
			var cart = new SimpleCart();
			var eventSink = new DummyEventSink();
			cart.eventSink = eventSink;
			cart.aggregateID = 'cart1';
			cart.addItem('12" wrench', 15.99);
			cart.commit();
			
			function supposedlyIdempotentOperation(opID){
				return tryWith(eventSink, SimpleCart, 'cart1', function completeOrderService(AR){
					return AR.completeOrder();
				}, {
					commandID: opID,
					failureLogger: console.log
				});
			}
			supposedlyIdempotentOperation('op1').then(
			function(commandResult){
				var firstBill = commandResult;
				if(firstBill !== 15.99){
					return testDone(new Error('First bill incorrect: should be 15.99, is ' + firstBill));
				}
				
				// Now that we have done the "known-good" measurement, retry this operation (simulate a client failing to get the result etc.).
				supposedlyIdempotentOperation('op1').then(
				function(secondCommandResult){
						var secondBill = secondCommandResult;
						testDone(secondBill === firstBill ? null : new Error('First bill is ' + firstBill + ', but second turns out to be ' + secondBill));
					},
				testDone // Rejected -> pass-through to the test framework.
				);
			},
			testDone
			);
		});
	});
});