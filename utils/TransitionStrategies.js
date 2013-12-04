function EventTypesRequired(eventTypeArray){
	return function _transitionPossible(event, commit, queuedEvents, accumulator){
		var knownEvents = queuedEvents.concat([event]);
		return eventTypeArray.every(function(eventType){
			return (knownEvents.indexOf(eventType) >= 0);
		});
	};
}

module.export.EventTypesRequired = EventTypesRequired;