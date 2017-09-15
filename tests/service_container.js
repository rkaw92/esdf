var ServiceContainer = require('..').services.ServiceContainer;
var assert = require('assert');

describe('ServiceContainer', function(){
	var testContainer = new ServiceContainer();
	var testServiceA = function(resources){
		return 5; // Not very ambitious, but it will do for a simple service!
	};
	var testServiceB = function(resources){
		return resources.dummyDB.read().toUpperCase();
	};
	var circleAreaService = function(resources, radius){
		return resources.pi * radius * radius;
	};
	var dummyDBResource = {
		read: function(){
			return 'your data';
		}
	};
	describe('#addResource', function(){
		it('should add a resource to the container\'s context', function(){
			testContainer.addResource('dummyDB', dummyDBResource);
			assert.equal(Object.keys(testContainer.getResources()).length, 1);
		});
	});
	describe('#addService', function(){
		it('should add a service to the container', function(){
			testContainer.addService('testServiceA', testServiceA);
			assert.equal(Object.keys(testContainer.getServices()).length, 1);
		});
		it('should add other services to the container', function(){
			testContainer.addService('circleAreaService', circleAreaService);
			testContainer.addService('testServiceB', testServiceB);
			assert.equal(Object.keys(testContainer.getServices()).length, 3);
		});
	});
	describe('#service', function(){
		it('should retrieve a service function which can subsequently be called', function(){
			assert.strictEqual(testContainer.service('testServiceA')(), 5);
		});
		it('should refuse to produce a nonexistent service', function(){
			assert.throws(function(){
				testContainer.service('noSuchService')();
			});
		});
		it('should allow the service to make use of provided resources', function(){
			assert.equal(testContainer.service('testServiceB')(), 'YOUR DATA');
		});
	});
	describe('#createServiceGetter', function(){
		it('should create a service getter which acts the same as #service, while being a stand-alone function', function(){
			var viaService = testContainer.service('testServiceA');
			var viaGetter = testContainer.createServiceGetter({})('testServiceA');
			// Note: the below line relies on our example service being a pure (stateless) function for value comparison.
			//  We can not compare function objects by ===, since they are presumably mangled by .bind() and hence are not the same JS entity.
			assert.strictEqual(viaService(), viaGetter());
		});
		it('should properly inject additional resources to the service context', function(){
			var piValue = 3.14159;
			var serviceGetter = testContainer.createServiceGetter({pi: piValue});
			// Check if the circle area computation service can use our Pi value, provided to it via resources.
			assert.strictEqual(serviceGetter('circleAreaService')(2), 2*2*piValue);
		});
		it('should not prevent the use of statically-defined resources', function(){
			assert.equal(testContainer.createServiceGetter({})('testServiceB')(), 'YOUR DATA');
		});
		it('should shadow statically-defined resources with dynamic ones (passed to createServiceGetter)', function(){
			assert.equal(testContainer.createServiceGetter({
				dummyDB: {
					read: function(){
						return 'don\'t panic';
					}
				}
			})('testServiceB')(), 'DON\'T PANIC');
		});
	});
});
