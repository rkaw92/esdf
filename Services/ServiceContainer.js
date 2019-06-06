/**
 * @module esdf/services/ServiceContainer
 */

/**
 * A Service Container is an object whose sole purpose is to contain functions (services) and make them available for use to other functions.
 * This component is typically used for Dependency Injection to pass only one neat object-oriented facade to a set of services, instead of a large map or multiple function arguments.
 * Within a service container, all services require a specific function signature: the first argument must be a dependency object whose keys are dependency names, containing run-time resources for services' use.
 * @constructor
 */
function ServiceContainer(){
	/**
	 * Contains service handlers, indexed by name.
	 * @type {Object.<string,function>}
	 * @private
	 */
	this._serviceFunctions = {};
	/**
	 * Stores static resources, passed as the first argument to every service called (via bind, when requesting the service). String-keyed with arbitrary values.
	 * Note that this map does not constitute the full nor the final dependencies passed as the first argument - they may be added or overriden by dynamically-generated resources at service call time.
	 * @type {Object}
	 * @private
	 */
	this._resources = {};
	/**
	 * A wrapper function that gets executed instead of the actual service.
	 * By default, all that this does is execute the service function, passed
	 *  as the second argument, with all parameters that follow. However, it is
	 *  possible to override this behavior to enable more complex features,
	 *  such as providing as a join point for AOP.
	 * @type {function}
	 */
	this._serviceWrapper = function _transparentServiceWrapper(serviceName, service) {
		var params = Array.prototype.slice.call(arguments, 2);
		return service.apply(undefined, params);
	};
}

/**
 * Add a service function to the set of functions offered by this service container.
 * @param {string} serviceName What the service should be known as. This is the name used to retrieve the service function via #service (or from a generated service getter function).
 * @param {function} serviceFunction The function to add. Must adhere to the service signature, i.e. accept an object (key-value map) containing dependencies as its first argument.
 */
ServiceContainer.prototype.addService = function addService(serviceName, serviceFunction){
	this._serviceFunctions[serviceName] = serviceFunction;
};

/**
 * Add a resource to the set of static resources passed to the service on every run. Note that static resources may still be masked by dynamic ones if using a service getter with dynamic dependency generation.
 * @param {string} resourceName The name to be used as key in the dependency key-value map passed to each call of every service.
 * @param resourceValue The value of the resource to be passed to the service. Note that the resource is *not* copied but merely passed, so object safety should be taken into consideration.
 */
ServiceContainer.prototype.addResource = function addResource(resourceName, resourceValue){
	this._resources[resourceName] = resourceValue;
};

/**
 * Set the service wrapper to use when executing services. It is possible to
 *  wrap each invocation in a custom function, so that it functions as
 *  a join-point for logging, policy enforcement, etc.
 * Note that it is the wrapper's responsibility to proxy the service, so it
 *  should probably return the service's return value, respect promises etc.
 * Also note that, when wrapping a synchronous service, if your wrapper returns
 *  a Promise, the caller will get exactly that. Similarly, if your wrapper
 *  rejects or throws instead of calling the service, the targeted service will
 *  simply not run. Thus, in scenarios where the cross-cutting concern should
 *  not impact the interface or the execution of the service, it is advisable
 *  to not await the wrapper's promises and handle errors out-of-band.
 * @param {function(function,...params)} wrapper - The service wrapper function that gets the service name as the first argument, the actual service function as the second argument, the generated/supplied resources as the third, and call-time parameters as subsequent (4..n) arguments.
 */
ServiceContainer.prototype.setServiceWrapper = function setServiceWrapper(wrapper) {
	if (typeof wrapper !== 'function') {
		throw new TypeError('wrapper must be a function');
	}
	this._serviceWrapper = wrapper;
};

/**
 * Get a service function by name, with the first parameter bound to the value
 *  of the static resources with dynamically-generated resources overlaid
 *  on them. Note that this actually returns the bound service wrapper, not the
 *  bare service function which was registered.
 * @private
 * @param {Object} providedResources The static resources, as previously registered by addResource.
 * @param {function} generatorFunction The function used to generate the dynamic runtime resources. No arguments are passed to it. Should return an object whose keys and values will be treated as if registered by addResource.
 * @param {string} serviceName The name of the service to retrieve. The service needs to have been registered previously via addService with the same name.
 * @returns {function} The requested service with the first argument bound to a key-value map of provided dependencies.
 */
ServiceContainer.prototype._getBoundService = function _getBoundService(providedResources, generatorFunction, serviceName){
	var activeResources = {};
	for(var resourceName in this._resources){
		activeResources[resourceName] = this._resources[resourceName];
	}
	for(var resourceName in providedResources){
		activeResources[resourceName] = providedResources[resourceName];
	}
	if(typeof(this._serviceFunctions[serviceName]) === 'function'){
		if(typeof(generatorFunction) === 'function'){
			// If dynamic resource generation is required, we call the generator and overwrite the static resources with it.
			var generatedResources = generatorFunction();
			for(var k in generatedResources){
				if(Object.prototype.hasOwnProperty.call(generatedResources, k)){
					activeResources[k] = generatedResources[k];
				}
			}
		}
		return this._serviceWrapper.bind(undefined, serviceName, this._serviceFunctions[serviceName], activeResources);
	}
	else{
		throw new Error('Service does not exist: ' + serviceName);
	}
};



/**
 * Get a service function by name. Note that the service function is not automatically called, so a typical use might look like this: service('doSomething')(params);
 * @param {string} serviceName Name of the service function to retrieve.
 * @returns {function} The service function, properly bound to use the run-time parameters defined earlier via #addResource().
 */
ServiceContainer.prototype.service = function service(serviceName){
	return this._getBoundService(this._resources, null, serviceName);
};

/**
 * Create a stand-alone function which can subsequently be used to retrieve service functions from the container.
 * @param {Object|function} contextResources The resources which should be overlaid on the statically-registered ones. If an object is passed, its keys are used as resource names and store the corresponding values provided in the object. If passed a function, it is called every time the getter is run and is expected to provide the additional runtime resources in the same kind of object map.
 * @returns {function} A function which accepts the service name as the sole argument and returns the bound service function with the run-time dependencies set as the first argument.
 */
ServiceContainer.prototype.createServiceGetter = function createServiceGetter(contextResources){
	if(typeof(contextResources) === 'object'){
		return this._getBoundService.bind(this, contextResources, null);
	}
	else if(typeof(contextResources) === 'function'){
		// In case the resources were a dynamic generator, the generator is passed for further execution to the generated service getter.
		return this._getBoundService.bind(this, {}, contextResources);
	}
	else{
		throw new Error('Context resources need to be either a ready-to-use object or an object-generating function');
	}
};

/**
 * Get the run-time resources registered so far with the service container.
 * @returns {Object} A map of registered resources, keyed by resource name (just like what the services see).
 */
ServiceContainer.prototype.getResources = function getResources(){
	return this._resources;
};

/**
 * Get the services registered so far with the service container.
 * @returns {Object} An object whose keys correspond to the service names and whose values are the service functions themselves. Note that the returned functions are not bound, i.e. do not have the first argument (dependencies) automatically passed.
 */
ServiceContainer.prototype.getServices = function getServices(){
	return this._serviceFunctions;
};

module.exports.ServiceContainer = ServiceContainer;
