var set = require('./setImmutable');
var Context = require('./Context');

var exceptionPrototype = Object.create(Error.prototype);

exceptionPrototype.setCause = function setCause(underlyingError){
	set.call(this, 'cause', underlyingError);
};

exceptionPrototype.setContext = function setContext(context){
	set.call(this, 'context', context);
};

exceptionPrototype.toString = function toString(){
	function indentLines(lines){
		return '\n\t' + lines.split('\n').join('\n\t');
	}
	return this.name + (this.message ? (': ' + this.message) : '') + (this.cause ? indentLines('* ' + this.cause.toString()) : '');
};

exceptionPrototype.name = 'Exception';

Object.seal(exceptionPrototype);

function ExceptionContext(context){
	function Exception(initialize){
		var exception = Object.create(exceptionPrototype);
		var initializationArguments = Array.prototype.slice.call(arguments, 1);
		initialize.apply(exception, initializationArguments);
		exception.setContext(context);
		if(typeof(Error.captureStackTrace) === 'function'){
			Error.captureStackTrace(exception, Exception);
		}
		return exception;
	}
	Exception.getContext = function getContext(contextData){
		return ExceptionContext(context.enrich(contextData));
	};
	return Exception;
}

var Exception = ExceptionContext(Context({}));
module.exports = Exception;