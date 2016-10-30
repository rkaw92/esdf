module.exports.core = require('./lib/core');

module.exports.components = require('./lib/components');
module.exports.utils = require('./lib/utils');

module.exports.test = require('./lib/test');
module.exports.types = require('./lib/types');

module.exports.services = {
	ServiceContainer: require('./Services/ServiceContainer.js').ServiceContainer
};
