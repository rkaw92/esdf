// ### Requires and aliases ###

var esdf = require('..');
var util = require('util');
var when = require('when');
var LogicSaga = esdf.core.LogicSaga;
var Event = esdf.core.Event;
var Commit = esdf.core.Commit;

// ### Test components ###

function PackagingSaga(){
	this._stageHandlers = {
		'NotOrdered': function NotOrdered(event, commit, deps){
			if(event.eventType === 'OrderPlaced'){
				// Start packaging the order from which the event came.
				return deps.startPackaging(commit.sequenceID).then(function(){
					return when.resolve(new Event('OrderPlaced', {
						orderID: commit.sequenceID
					}));
				});
			}
			else{
				return when.reject();
			}
		},
		'Ordered': function Ordered(event, commit, deps){
			var self = this;
			if(commit.aggregateType === 'Warehouse' && event.eventType === 'OrderProcessingCompleted'){
				// Mark the order as packaged.
				return deps.markOrderAsPackaged(event.eventPayload.orderID).then(function(){
					self._setupTimer('archive', 'Archive', new Date(), new Date());
					return when.resolve(new Event('OrderPackaged', {}));
				});
			}
			else if(commit.aggregateType === 'Warehouse' && event.eventType === 'OrderProcessingFailed'){
				// Something went terribly wrong. Mark the failure.
				return deps.markOrderPackagingFailure(event.eventPayload.orderID).then(function(){
					return when.resolve();
				});
			}
			else{
				return when.reject();
			}
		},
		'Failed': function Failed(event, commit, deps){
			// This is a terminal stage. No other transitions occur from here.
			return when.reject();
		},
		'Packaged': function Packaged(event, commit, deps){
			return when.reject();
		},
		// Note that 'Archived' would not normally perform a useful business role - it is here solely to demonstrate how (and whether) timers work.
		'Archived': function Archived(event, commit, deps){
			return when.reject();
		}
	};
	this._currentStage = 'NotOrdered';
}
util.inherits(PackagingSaga, LogicSaga);

PackagingSaga.prototype.onOrderPlaced = function onOrderPlaced(event, commit){
	this._orderID = event.eventPayload.orderID;
	this._switchStage('Ordered');
};

PackagingSaga.prototype.onOrderPackaged = function onOrderPackaged(event, commit){
	this._switchStage('Packaged');
};

PackagingSaga.prototype.onOrderArchived = function onOrderArchived(event, commit){
	this._switchStage('Archived');
}

PackagingSaga.prototype.handleArchiveTimer = function handleArchiveTimer(timerID, actualTriggerTime, deps){
	var self = this;
	return deps.archiveOrder(this._orderID).then(function(){
		self._stageEvent(new Event('OrderArchived', {}));
	});
};

// ### Test runners ###

describe('LogicSaga', function(){
	var saga = new PackagingSaga();
	var testedOrderID = 'Order-1';
	describe('#processEvent', function(){
		it('should react to an event by calling a runtime service and effect a state transition', function(done){
			var orderEvent = new Event('OrderPlaced', {});
			var orderCommit = new Commit([orderEvent], testedOrderID, 1, 'Order');
			var packaging = false;
			saga.processEvent(orderEvent, orderCommit, {
				startPackaging: function(orderID){
					if(orderID === testedOrderID){
						packaging = true;
					}
					return when.resolve();
				}
			}).then(function(){
				if(packaging === true && saga._stagedEvents.some(function(event){
					return event.eventType === 'OrderPlaced';
				}) && saga._currentStage === 'Ordered'){
					done();
				}
				else{
					done(new Error('Something failed to work: either the order has not been marked as in packaging or a required state transition did not occur'));
				}
			});
		});
		it('should use a different handler than the first time after a state transition', function(done){
			var processingEvent = new Event('OrderProcessingCompleted', { orderID: testedOrderID });
			var processingCommit = new Commit([processingEvent], 'Warehouse-1', 1, 'Warehouse');
			var packaged = false;
			saga.processEvent(processingEvent, processingCommit, {
				markOrderAsPackaged: function(orderID){
					if(orderID === testedOrderID){
						packaged = true;
					}
					return when.resolve();
				}
			}).then(function(){
				if(packaged === true && saga._stagedEvents.some(function(event){
					return event.eventType === 'OrderPackaged';
				}) && saga._currentStage === 'Packaged'){
					done();
				}
				else{
					done(new Error('Order not marked as packaged for some reason or state transition failed'));
				}
			});
		});
	});
	describe('#handleTimer', function(){
		it('should carry out an operation when a timer is triggered', function(done){
			var archived = false;
			var deps = {
				archiveOrder: function archiveOrder(orderID){
					archived = true;
					return when.resolve({ archiveName: 'Storage-1' });
				}
			};
			saga.handleTimer('archive', new Date(), deps).then(function(){
				done(archived ? undefined : new Error('The operation has not been carried out for some reason!'));
			});
		});
	});
});
