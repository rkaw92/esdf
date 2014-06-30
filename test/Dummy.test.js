var assert = require('assert');
var esdf = require('../index');
var DummyEventStore = esdf.dummy.DummyEventStore;

describe('DummyEventStore', function(){
	describe('#streamSequenceCommits', function(){
		it('should call our callback exactly once before finishing the streaming', function(testDone){
			var store = new DummyEventStore({
				testStream: [ 'a' ]
			});
			var callbackCount = 0;
			store.streamSequenceCommits('testStream', 1, function(commit){
				callbackCount = callbackCount + 1;
			}).done(function(){
				assert(callbackCount === 1);
				testDone();
			}, testDone);
		});
	});
});