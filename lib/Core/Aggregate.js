/**
 * @module esdf/core/Aggregate
 * @exports module.exports
 */

function Aggregate(ID){
	this._aggregateID = ID;
}

Aggregate.prototype.getID = function getID(){
	return this._aggregateID;
};

module.exports.Aggregate = Aggregate;