# ESDF
...is a framework which lets you develop Domain-Driven applications using Event Sourcing in Node.js. It aims to achieve this by providing a useful set of base prototypes and utility functions that your application logic can be built on.
ESDF is heavily based on Promises/A (namely, the [when.js](https://github.com/cujojs/when) implementation) - all asynchronous functions in the codebase return promises instead of accepting callbacks.

## Domain-Driven Design
This framework is light on the DDD side, only defining an AggregateRoot in terms of the EventSourcingAggregate prototype. It does not deal with ValueObjects (meant to be represented by plain old JavaScript objects) nor embedding aggregates in ARs - it assumes a flat structure of AggregateRoots, and all events belong simply to the main Aggregate.

## Event Sourcing
The variant of Event Sourcing implemented considers a Commit, being an ordered list of events, and not a single Event, as the basic unit of storage. Thus, atomicity is guaranteed on the level of Commit, and an Aggregate is actually stored as a stream of Commits.
Each Commit may only belong to a single Aggregate's stream. The EventSourcedAggregate provides a method to stage (enqueue) an event for emission in memory and another to save all staged events as a Commit.
 

## Important components

### EventSourcedAggregate (prototype)
This is the most basic prototype, representing an Aggregate Root in your domain (not named EventSourcedAggregateRoot for brevity). It contains logic for staging events, saving batches of events as commits, re-applying them during aggregate rehydration and snapshotting. Extend this prototype into your own models.
Note that, since this is pure Event Sourcing, the only way to actually modify the aggregate's state is by emitting events. An EventSourcedAggregate should contain event handlers for the event types it generates - it is by this "listening to self" mechanism that changes to the internal state occur.
	
### EventSink (interface)
This interface defines methods used for sinking (saving) commits and rehydrating (loading) aggregates from streams of commits. Its functionality is equivalent to a traditional Repository. An EventSink implementation is tied to a particular database engine.
	
### EventStreamer (interface)
Asynchronous event dispatcher. Waits for new commits to appear in the Event Store (they usually end up there via the EventSink), then loads them and passes to a publisher. An implementation is tied to a particular database engine _and a sink implementation_, since they need to agree on the format that commits are represented in.

### EventPublisher (interface)
This component accepts commits from an EventStreamer and is meant to publish them to listeners. It may achieve this goal by using a pub/sub protocol, among others. A typical example is an AMQP client which accepts commits and publishes them to an exchange. There is no limitation as to whether events or commits in whole are published - it is left to the publisher's definition (for now).

### EventSubscriber (abstract concept, not defined in an interface yet)
A subscriber is specific to a specific publishing scheme and closely coupled with the publisher. Its role is the polar opposite of EventPublisher - it listens to events and lets the code react to them. For example, in CQRS, the process responsible for building the Read Model would use an EventSubscriber to get the events.

__Thus, you need to choose your infrastructural components in pairs of matching (EventSink, EventStreamer) and (EventPublisher, EventSubscriber).__ Also, note that operation without a Publisher/Subscriber pair, using only an EventStreamer, is possible, though not very convenient (the streamer only sees whole commits).

### tryWith and other helper functions
tryWith is a function which loads the specified aggregate, performs the user-provided function on it and saves the resulting events to the EventSink in one Commit. It is the workhorse of service-oriented applications - usually, a service will consist of one or a few calls to tryWith, performing certain operations on aggregates.

## Typical steps to build an ESDF-based application

Below is a commented source code snippet for an online product ordering system. Presented are a basic aggregate root implementation and a few services (standalone functions) used to issue commands on the AR.

```
var util = require('util');
var esdf = require('esdf');
var EventSourcedAggregate = esdf.core.EventSourcedAggregate;

// Now that we have the necessary Aggregate Root prototype, extend it.
//  The constructor should initialize the object's properties - this is the "base state", when no events have yet occured on the object.
//  This function is always called with zero arguments when ESDF loads the aggregate (though you can, of course, bind() a constructor beforehand).
function Order(){
	// Each line is a product code, quantity and a unit price. Indexed by product codes.
	this._lines = {};
}
util.inherits(Order, EventSourcedAggregate);
// Inform ESDF of the type name set for this aggregate. It uses AR types to filter events and ensure correctness while loading.
//  Any type name will do, but it probably makes the most sense to just use the prototype/class name.
Order.prototype._aggregateType = 'Order';

// Now, define some methods - this is the main mechanism through which behaviour is added to your domain.
Order.prototype.addItem = function addItem(productCode, quantity, unitPrice){
	// Elements of domain logic: verify the command, accept or decline to actually add an item.
	if(quantity <= 0){
		
	}
};
```


# TODO
Document the API and write a better overview, provide examples, finish commenting the code properly.

# License
MIT (see file LICENSE).