var assert = require('assert');
var esdf = require('../index');
var DummyEventStore = esdf.dummy.DummyEventStore;
// Loading:
var EventReplay = esdf.persistence.loaders.EventReplay;
var AggregateLoader = esdf.persistence.AggregateLoader;
// Saving:
var CommitSaver = esdf.persistence.loaders.CommitSaver;
var AggregateSaver = esdf.persistence.AggregateSaver;

function DummyAggregate(aggregateID){
	this._aggregateID = aggregateID;
	this._enabled = false;
	this._stagedEvents = [];
}
DummyAggregate.prototype.getAggregateID = function getAggregateID(){
	return this._aggregateID;
};
DummyAggregate.prototype.getNextSequenceNumber = function getNextSequenceNumber(){
	return 1;
};
DummyAggregate.prototype.isEnabled = function isEnabled(){
	return this._enabled;
};
DummyAggregate.prototype.onEnabled = function onEnabled(){
	this._enabled = true;
};
DummyAggregate.prototype.applyCommit = function applyCommit(commit){
	var events = commit.getEvents();
	events.forEach(function processSingleEvent(event){
		this['on' + event.type](event);
	}, this);
};
DummyAggregate.prototype.events = {
	Enabled: function Enabled(){
		this.type = 'Enabled';
		this.payload = {};
	}
};
DummyAggregate.prototype._stageEvent = function _stageEvent(event){
	this._stagedEvents.push(event);
};
DummyAggregate.prototype.getUncommittedEvents = function getUncommittedEvents(){
	return this._stagedEvents.slice();
};
DummyAggregate.prototype.markEventsAsCommitted(first, last){
	this._stagedEvents = [];
};


function getInitialStoreContents(){
	return {
		dummyID: [{
			sequenceID: 'dummyID',
			sequenceSlot: 1,
			originType: 'DummyAggregate',
			metadata: {},
			events: [ new DummyAggregate.prototype.events.Enabled() ]
		}]
	};
}

describe('EventReplay', function(){
	describe('#rehydrateAggregate', function(){
		it('should manage to rehydrate an aggregate instance from a commit stream', function(testDone){
			var store = new DummyEventStore(getInitialStoreContents());
			var replayLoader = new EventReplay(store);
			var aggregate = new DummyAggregate('dummyID');
			replayLoader.rehydrateAggregate(aggregate).done(function checkRehydrationCorrectness(rehydratedAggregate){
				assert(rehydratedAggregate.isEnabled());
				testDone();
			});
		});
	});
});

describe('AggregateLoader', function(){
	describe('#loadAggregate', function(){
		it('should load an aggregate using a loader backend supplied to the AggregateLoader', function(testDone){
			var store = new DummyEventStore(getInitialStoreContents());
			var replayLoaderBackend = new EventReplay(store);
			var loader = new AggregateLoader([ replayLoaderBackend ]);
			loader.loadAggregate(DummyAggregate, 'dummyID').done(function checkAggregateCorrectness(loadedAggregate){
				assert(loadedAggregate);
				assert(loadedAggregate.isEnabled());
				testDone();
			});
		});
	});
});

describe('CommitSaver', function(){
	describe('#persistAggregate', function(){
		it('should save the staged events of an aggregate in a commit', function(testDone){
			var store = new DummyEventStore();
			var commitSaver = new CommitSaver(store);
			var aggregate = new DummyAggregate('dummyID');
			aggregate._stageEvent(new aggregate.events.Enabled());
			var executionContext = { annotation: 'annotationValue' };
			commitSaver.persistAggregate(aggregate, executionContext);
			assert.equal(store.countSequenceCommits('dummyID'), 1);
		});
	});
});