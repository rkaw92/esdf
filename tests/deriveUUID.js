var deriveUUID = require('../utils/deriveUUID.js').deriveUUID;
var assert = require('assert');

var testNS1 = 'c3bda8a6-8d01-49a4-b0cc-a1de27c9cde5';
var testNS2 = '39ee5d52-22b0-410f-97aa-faafc80937ec';

describe('deriveUUID', function(){
	it('should generate a UUID from a base name', function(){
		assert.equal(typeof(deriveUUID('test1', testNS1)), 'string');
	});
	it('should generate two identical UUIDs for the same name/namespace combination', function(){
		assert.equal(deriveUUID('test1', testNS1), deriveUUID('test1', testNS1));
	});
	it('should generate two different UUIDs for different names', function(){
		assert.notEqual(deriveUUID('test1', testNS1), deriveUUID('test2', testNS1));
	});
	it('should generate two different UUIDs for the same name in different namespaces', function(){
		assert.notEqual(deriveUUID('test1', testNS1), deriveUUID('test1', testNS2));
	});
	it('should generate two different UUIDs for different names in different namespaces', function(){
		assert.notEqual(deriveUUID('test1', testNS1), deriveUUID('test2', testNS2));
	});
});