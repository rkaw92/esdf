var DummyEventSink = require('../EventStore/DummyEventSink.js').DummyEventSink;
var EventSourcedAggregate = require('../EventSourcedAggregate.js').EventSourcedAggregate;
var AggregateLoader = require('../utils/loadAggregate.js');
var Event = require('../Event').Event;
var tryWith = require('../utils').tryWith;
var when = require('when');
var assert = require('assert');

var sink = new DummyEventSink();
var loader = AggregateLoader.createAggregateLoader(sink, undefined);

function DummyAggregate(){
	this._initializeAggregateMetadata();
}
DummyAggregate.prototype = new EventSourcedAggregate();
DummyAggregate.prototype.onDummyEvent = function(){}; // Complete and utter ignorance.

describe('tryWith', function(){
	it('should execute the given method and commit the results without any retries', function(test_finished){
		tryWith(loader, DummyAggregate, 'dummy-1', function(ar){
			ar._stageEvent(new Event('DummyEvent', {bull: "crap"}));
		}).then(function(result){
			test_finished(sink._streams['dummy-1'] ? undefined : new Error('No streams registered in the sink after commit!'));
		}, function(reason){test_finished(reason ? reason : new Error('tryWith callback rejected!'));});
	});
	
	it('should execute the given method and commit the results after exactly 5 unsuccessful tries', function(test_finished){
		var commit_fail_count = 0;
		sink._wantSinkSuccess = false;
		tryWith(loader, DummyAggregate, 'dummy-2', function(ar){
			ar._stageEvent(new Event('DummyEvent', {bull: "crap"}));
		}, {
			failureLogger: function(err){
				if(err.labels && err.labels.tryWithErrorType === 'commitError'){
					++commit_fail_count;
				}
				if(commit_fail_count >= 5){ sink._wantSinkSuccess = true; } },
			commandID: 'FAILME'
		}).then(function(result){
			if(!sink._streams['dummy-2']){
				return test_finished(new Error('No stream named dummy-2 registered!'));
			}
			if(commit_fail_count !== 5){
				return test_finished(new Error('Commit fail count is ' + commit_fail_count + ', should be 5'));
			}
			return test_finished();
		},
		function(reason){test_finished(reason ? reason : new Error('tryWith callback rejected!'));});
	});
	
	it('should execute the given method twice, giving the same result the second time as the first time', function(test_finished){
		var commandID = 'dead-beef-1234'; // Not much of an UUID, but it will do.
		// Assign a method to the AR. The method should be naturally non-idempotent - calling it the second time should produce an error outside of tryWith.
		EventSourcedAggregate.prototype.initializeExclusively = function(){
			if(!this.alreadyInitialized){
				this.stage('InitializedExclusively');
				return true;
			}
			else{
				throw new Error('Exclusive initialization is only possible once!');
			}
		};
		// Issue the command for the first time...
		//tryWith(sink, EventSourcedAggregate, 'dummy-3', );
		// And the second time.
		//TODO
		test_finished();
	});
});