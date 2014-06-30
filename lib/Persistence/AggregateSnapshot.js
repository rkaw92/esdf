/**
 * @module esdf/utils/AggregateSnapshot
 */
//TODO: make a type out of this and move to dedicated type directory?
function AggregateSnapshot(aggregateType, aggregateID, aggregateData, lastSlotNumber){
	this.aggregateType = aggregateType;
	this.aggregateID = aggregateID;
	this.aggregateData = aggregateData;
	this.lastSlotNumber = lastSlotNumber;
}

AggregateSnapshot.isAggregateSnapshot = function isAggregateSnapshot(object){
	return (typeof(object) === 'object' && object !== null && object.aggregateType && object.aggregateID && object.aggregateData && typeof(object.lastSlotNumber) === 'number');
};

module.exports.AggregateSnapshot = AggregateSnapshot;