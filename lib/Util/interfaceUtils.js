/**
 * @module esdf/util/interfaceUtils
 */ 

/**
 * An error type generated on API/interface mismatch.
 * @constructor
 * @extends {Error}
 */
module.exports.InterfaceError = function InterfaceError(invalidProperty){
	this.name = 'InterfaceError';
	this.message = 'The object does not match an interface specification because it is missing a required method/property or the property is of a different type (and not null): ' + invalidProperty;
	this.code = 32303;
	this.data = {
		invalidProperty: invalidProperty
	};
};

/**
 * Ensure that a given object posesses the methods/properties promised by a given interface.
 * For properties which are not methods, only the type (via typeof()) is checked.
 * For methods (functions), the arity (length) is compared as well.
 * @param {Object} subject The inspected object whose adherence to the interface is to be checked.
 * @param {Object} interfaceObject The interface, specifying what methods and/or properties the subject must have (and of what type).
 * @throws {module:esdf/util/interfaceUtils~InterfaceError}
 */
function assertInterface(subject, interfaceObject){
	Object.keys(interfaceObject).forEach(function(property){
		// First, ensure that the types of the property are the same in both objects, the "template" (interface) and the instance.
		if (typeof(interfaceObject[property]) !== typeof(subject[property]) && subject[property] !== null){
			throw new InterfaceError(property);
		}
		if(typeof(interfaceObject[property]) === 'function'){
			// If the subject is required to have a function as specified, verify its arity:
			if(typeof(subject[property]) !== 'function' || interfaceObject[property].length !== subject[property].length){
				throw new InterfaceError(property);
			}
		}
	});
}

module.exports.assertInterface = assertInterface;
module.exports.errors = {
	InterfaceError: InterfaceError
};