'use strict';

const esdf = require('../');
const EventSourcedAggregate = esdf.core.EventSourcedAggregate;
const Event = esdf.core.Event;
const util = require('util');
const assert = require('assert');

function RichAggregate(){
	this._soRich = 'wow';
	this.amazement = null;
}
util.inherits(RichAggregate, EventSourcedAggregate);
RichAggregate.prototype._aggregateType = 'RichAggregate';
RichAggregate.prototype._enrichEvent = function _enrichEvent(event){
	switch(event.eventType){
		case 'PedestriansAmazed':
			event.eventPayload.soRich = this._soRich;
			break;
		default:
		// No default action - we only enrich certain events here.
	}
};
RichAggregate.prototype.flaunt = function flaunt(gadget){
	this._stageEvent(new Event('PedestriansAmazed', {
		gadget: gadget
	}));
};
RichAggregate.prototype.onPedestriansAmazed = function onPedestriansAmazed(event){
	this.amazement = event.eventPayload;
};

describe('EventSourcedAggregate', function(){
	describe('#_enrichEvent', function(){
		it('should enrich the event with contextual information provided by the aggregate', function(){
			var richie = new RichAggregate();
			richie.flaunt('Pontiac');
			assert.equal(richie.amazement.gadget, 'Pontiac');
			assert.equal(richie.amazement.soRich, 'wow');
		});
	});
});
