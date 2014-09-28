var DummyEventStore = require('../lib/Dummy/DummyEventStore').DummyEventStore;
var EventSourcedAggregateRoot = require('./EventSourcedAggregateRoot').EventSourcedAggregateRoot;
var EventSourcedAggregateRootRepository = require('./EventSourcedAggregateRootRepository').EventSourcedAggregateRootRepository;

function Order(){
	this.realized = false;
	this.realizationDate = null;
}
Order.prototype = new EventSourcedAggregateRoot();

Order.prototype.eventHandlers = {
	Realized: function(data){
		this.realized = true;
		this.realizationDate = new Date(data.date);
	}
};

Order.prototype.realize = function realize(){
	this.raiseEvent('Realized', {
		date: (new Date()).toISOString()
	});
};

var myOrder = new Order();
myOrder.realize();
console.log('Aggregate state:', myOrder);
console.log('Events:', myOrder.getNewEvents());