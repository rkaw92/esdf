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
		sink._failureLabels = {
			isRetriable: true
		};
		tryWith(loader, DummyAggregate, 'dummy-2', function(ar){
			ar._stageEvent(new Event('DummyEvent', {bull: "crap"}));
		}, {
			failureLogger: function(err){
				commit_fail_count += 1;
				if(commit_fail_count >= 5){ sink._wantSinkSuccess = true; }
			},
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
	
	it('should immediately fail despite a retry strategy deciding to retry', function(testFinished) {
		var testError = new Error('Test critical error');
		testError.name = 'TestError';
		
		var errorLoader = function errorLoader(aggregateConstructor, aggregateID) {
			return when.reject(testError);
		};
		
		tryWith(errorLoader, DummyAggregate, 'dummy-3', function(){}).done(function() {
			testFinished(new Error('Unexpected success - tryWith() was supposed to reject'));
		}, function(tryWithError) {
			assert(tryWithError.name, 'TestError');
			testFinished();
		});
	});
});