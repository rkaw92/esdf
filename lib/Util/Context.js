var contextMethods = Object.create(null);

contextMethods.enrich = function enrich(additionalProperties){
	var currentProperties = this.data;
	var finalProperties = {};
	// Copy over the current properties:
	Object.keys(currentProperties).forEach(function(propertyName){
		finalProperties[propertyName] = currentProperties[propertyName];
	});
	// As well as the new properties:
	Object.keys(additionalProperties).forEach(function(propertyName){
		finalProperties[propertyName] = additionalProperties[propertyName];
	});
	//TODO: Determine whether to reject key collisions and throw an error or instead accept them as normal course of action and overwrite the previous properties.
	// For now, we simply mask the previous keys.
	return new Context(finalProperties);
};

contextMethods.get = function get(dataProperty){
	if(Object.prototype.hasOwnProperty.call(this.data, dataProperty)){
		return this.data[dataProperty];
	}
	else{
		throw new Error('Data property not found in the context data: ' + dataProperty);
	}
};

Object.seal(contextMethods);

function Context(data){
	// The main purpose of this constructor ("maker") is ensuring that the context is immutable.
	var dataDescriptors = {};
	Object.keys(data).forEach(function(dataKey){
		dataDescriptors[dataKey] = {
			writable: false,
			configurable: false,
			enumerable: true,
			value: data[dataKey]
		};
	});
	var dataProperty = Object.seal(Object.create(null, dataDescriptors));
	return Object.seal(Object.create(contextMethods, {
		data: {
			writable: false,
			configurable: false,
			enumerable: true,
			value: dataProperty
		}
	}));
}



module.exports = Context;