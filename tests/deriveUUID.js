var deriveUUID = require('../utils/deriveUUID.js').deriveUUID;
var assert = require('assert');

var testNS1 = 'c3bda8a6-8d01-49a4-b0cc-a1de27c9cde5';
var testNS2 = '39ee5d52-22b0-410f-97aa-faafc80937ec';

describe('deriveUUID', function(){
	it('should generate a UUID from a base name', function(){
		assert.equal(typeof(deriveUUID(testNS1, 'test1')), 'string');
	});
	it('should generate two identical UUIDs for the same name/namespace combination', function(){
		assert.equal(deriveUUID(testNS1, 'test1'), deriveUUID(testNS1, 'test1'));
	});
	it('should generate two different UUIDs for different names', function(){
		assert.notEqual(deriveUUID(testNS1, 'test1'), deriveUUID(testNS1, 'test2'));
	});
	it('should generate two different UUIDs for the same name in different namespaces', function(){
		assert.notEqual(deriveUUID(testNS1, 'test1'), deriveUUID(testNS2, 'test1'));
	});
	it('should generate two different UUIDs for different names in different namespaces', function(){
		assert.notEqual(deriveUUID(testNS1, 'test1'), deriveUUID(testNS2, 'test2'));
	});
});