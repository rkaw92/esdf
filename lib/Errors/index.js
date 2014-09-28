

module.exports.LoaderOutputMalformedError = function LoaderOutputMalformedError(output){
	this.name = 'LoaderOutputMalformedError';
	this.message = 'Loader output malformed. Failed to rehydrate an aggregate.';
};