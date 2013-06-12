module.exports.core = {};
module.exports.core.EventSourcedAggregate = require('./EventSourcedAggregate.js').EventSourcedAggregate;
module.exports.core.createReadStream = require('./EventSourceTemplate.js').createReadStream;
module.exports.utils = require('./utils');
module.exports.test = {};
module.exports.test.DummyEventSink = require('./DummyEventSink.js').DummyEventSink;
//TODO: provide a DummyEventSource