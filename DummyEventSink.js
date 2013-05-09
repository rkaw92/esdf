var when = require('when');
function DummyEventSink(){
	this._want_success = true;
	this._failure_type = 'DummyEventSink test failure';
};

DummyEventSink.prototype.sink = function sink(event, ar_id, sequence_number){
	var r = when.defer().resolver;
	var reject_error = new Error('DummyEventSink reject');
	reject_error.type = this._failure_type;
	return (this._want_success) ? r.resolve('DummyEventSink resolve') : r.reject(reject_error);
};

module.exports = DummyEventSink;