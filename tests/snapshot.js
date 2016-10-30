var Snapshot = require('../').types.AggregateSnapshot;
var DummyAggregateSnapshotter = require('../').test.DummyAggregateSnapshotter;
var assert = require('assert');

var db1 = new DummyAggregateSnapshotter();
describe('DummyAggregateSnapshotter', function(){
	describe('#saveSnapshot', function(){
		it('should resolve the saving promise', function(done){
			db1.saveSnapshot(new Snapshot('dummy', '1', {}, 0)).then(done.bind(undefined, undefined), done);
		});
		it('should refuse the object as non-Snapshot type', function(done){
			db1.saveSnapshot({prop1: 'val1'}).then(done.bind(undefined, new Error('Should never happen')), done.bind(undefined, undefined));
		});
	});
	describe('#loadSnapshot', function(){
		it('should retrieve the previously-saved dummy snapshot', function(done){
			db1.loadSnapshot('1').then(function(snapshot){
				assert(Snapshot.isAggregateSnapshot(snapshot)); // most idiomatic line ever
				done();
			}, done);
		});
		it('should not retrieve a nonexistent snapshot, rejecting the load promise', function(done){
			db1.loadSnapshot('2').then(done.bind(undefined, new Error('AggregateSnapshot loaded when it should not have been')), done.bind(undefined, undefined));
		});
	});
});