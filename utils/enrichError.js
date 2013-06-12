/**
 * @module esdf/utils/enrichError
 */
function enrichError(err, label_name, label_value){
	//Functions are objects, too, so they can be enriched just as well.
	if(typeof(err) === 'object' || typeof(err) === 'function'){
		if(typeof(err.labels !== 'object')){
			err.labels = {};
		}
		err.labels[label_name] = label_value;
	}
}

module.exports.enrichError = enrichError;