/**
 * @module esdf/utils/enrichError
 */
function enrichError(err, labelName, labelValue){
	//Functions are objects, too, so they can be enriched just as well.
	if((typeof(err) === 'object' && err !== null) || typeof(err) === 'function'){
		if(typeof(err.labels !== 'object')){
			err.labels = {};
		}
		err.labels[labelName] = labelValue;
	}
}

function getLabel(err, labelName){
	if((typeof(err) === 'object' && err !== null) || typeof(err) === 'function'){
		return ((typeof(err.labels) === 'object') ? err.labels[labelName] : undefined);
	}
}

module.exports.enrichError = enrichError;
module.exports.getLabel = getLabel;