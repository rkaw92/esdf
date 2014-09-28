'use strict';

function setImmutable(key, value, hidden){
	Object.defineProperty(this, key, {
		writable: false,
		configurable: false,
		enumerable: !hidden,
		value: value
	});
}
setImmutable.call(setImmutable, 'help', {
	name: 'setImmutable',
	description: 'Assign an unchangeable, non-deletable value to a key within the current object, pointed to by `this`.',
	params: [{
		name: 'key',
		type: 'string',
		description: 'The property name to set.'
	}, {
		name: 'value',
		type: 'any',
		description: 'The value to assign to the property. The value can not be changed afterwards (!writable, !configurable).'
	}, {
		name: 'hidden',
		type: 'boolean',
		optional: true,
		description: 'Whether the property should be defined as non-enumerable. If truthy, iterating through the object\'s properties will not discover this key.'
	}],
	example: 'var obj = {}; setImmutable.call(obj, \'configKey\', \'configValue\'); obj.configKey = \'otherValue\'; // Does not update the value; in strict mode, a TypeError error is produced on assignment!'
});

module.exports = setImmutable;