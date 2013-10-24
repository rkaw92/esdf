# ESDF
...is a framework which lets you develop Domain-Driven applications using Event Sourcing in Node.js. It aims to achieve this by providing a useful set of base prototypes and utility functions that your application logic can be built on.
ESDF is heavily based on Promises/A (namely, the [https://github.com/cujojs/when](when.js) implementation) - all asynchronous functions in the codebase return promises instead of accepting callbacks.

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
This component accepts commits from an EventStreamer and is meant to publish them to listeners. It may achieve this goal by using a pub/sub protocol, among others. A typical example is an AMQP client which accepts commits and publishes them to an exchange.

### EventSubscriber (abstract concept, not defined in an interface yet)
A subscriber is specific to a specific publishing scheme and closely coupled with the publisher. Its role is the polar opposite of EventPublisher - it listens to messages and lets the code react to them.

__Thus, you need to choose your infrastructural components in pairs of matching (EventSink, EventStreamer) and (EventPublisher, EventSubscriber).__

### tryWith and other helper functions
tryWith is a function which loads the specified aggregate, performs the user-provided function on it and saves the resulting events to the EventSink in one Commit. It is the workhorse of service-oriented applications - usually, a service will consist of one or a few calls to tryWith, performing certain operations on aggregates.

# TODO
Document the API and write a better overview, provide examples, finish commenting the code properly.

# License
MIT (see file LICENSE).