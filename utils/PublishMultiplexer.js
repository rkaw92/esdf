var when = require('when');

function PublishMultiplexer(){
	this._publishers = [];
}
PublishMultiplexer.prototype.publishCommit = function publishCommit(commit){
	var publishPromises = [];
	this._publishers.forEach(function(publisher){
		publishPromises.push(publisher.publishCommit(commit));
	});
	return when.all(publishPromises);
};

PublishMultiplexer.prototype.addPublisher = function addPublisher(publisher){
	this._publishers.push(publisher);
};

module.exports.PublishMultiplexer = PublishMultiplexer;