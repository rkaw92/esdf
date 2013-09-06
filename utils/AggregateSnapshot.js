/**
 * @module esdf/utils/AggregateSnapshot
 */
//TODO: make a type out of this and move to dedicated type directory?
function AggregateSnapshot(aggregateID, aggregateData, lastSlotNumber){
	this.aggregateID = aggregateID;
	this.aggregateData = aggregateData;
	this.lastSlotNumber = lastSlotNumber;
}

AggregateSnapshot.isAggregateSnapshot = function isAggregateSnapshot(object){
	return (typeof(object) === 'object' && object !== null && object.aggregateID && object.aggregateData && typeof(object.lastSlotNumber) === 'number');
};

module.exports.AggregateSnapshot = AggregateSnapshot;