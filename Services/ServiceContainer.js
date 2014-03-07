function ServiceContainer(){
	/**
	 * Contains service handlers, indexed by name.
	 */
	this._serviceFunctions = {};
	/**
	 * Stores static resources, passed as the first argument to every service called (via bind, when requesting the service).
	 */
	this._resources = {};
}

ServiceContainer.prototype.addService = function addService(serviceName, serviceFunction){
	this._serviceFunctions[serviceName] = serviceFunction;
};

ServiceContainer.prototype.addResource = function addResource(resourceName, resourceValue){
	this._resources[resourceName] = resourceValue;
};

ServiceContainer.prototype._getBoundService = function _getBoundService(providedResources, generatorFunction, serviceName){
	if(typeof(this._serviceFunctions[serviceName]) === 'function'){
		if(typeof(generatorFunction) === 'function'){
			// If dynamic resource generation is required, we call the generator and overwrite the static resources with it.
			var generatedResources = generatorFunction();
			for(var k in generatedResources){
				if(Object.prototype.hasOwnProperty.call(generatedResources, k)){
					providedResources[k] = generatedResources[k];
				}
			}
		}
		return this._serviceFunctions[serviceName].bind(undefined, providedResources);
	}
	else{
		throw new Error('Service does not exist: ' + serviceName);
	}
};

ServiceContainer.prototype.createServiceGetter = function createServiceGetter(contextResources){
	var completeResourcesObject = {};
	// The context's resources shall contain our original resources...
	for(var staticResourceName in this._resources){
		completeResourcesObject[staticResourceName] = this._resources[staticResourceName];
	}
	if(typeof(contextResources) === 'object'){
		// ... as well as the resources passed into this function.
		for(var dynamicResourceName in contextResources){
			completeResourcesObject[dynamicResourceName] = contextResources[dynamicResourceName];
		}
		return this._getBoundService.bind(this, completeResourcesObject, null);
	}
	else if(typeof(contextResources) === 'function'){
		// In case the resources were a dynamic generator, the generator is passed for further execution to the generated service getter.
		return this._getBoundService.bind(this, completeResourcesObject, contextResources);
	}
	else{
		throw new Error('Context resources need to be either a ready-to-use object or an object-generating function');
	}
};

ServiceContainer.prototype.service = function service(serviceName){
	return this._getBoundService(this._resources, null, serviceName);
};

ServiceContainer.prototype.getResources = function getResources(){
	return this._resources;
};

ServiceContainer.prototype.getServices = function getServices(){
	return this._serviceFunctions;
};

module.exports.ServiceContainer = ServiceContainer;