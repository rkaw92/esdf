var mongo = require('mongodb');
var EventEmitter = require('events').EventEmitter;
var db = new mongo.Db('test', new mongo.Server('127.0.0.1', 27017), {w: 0});

var testPoller = function(){
	var ev = new EventEmitter();
	setImmediate(function(){
		db.open(function(err, client){
			client.collection('capped_test', function(err, capped_collection){
				var cursor = capped_collection.find({}, {}, {tailable: true});
				cursor.sort({'$natural': 1});
				function fetch_reentrant(){
					cursor.nextObject(function(err, document){
						if(!err){
							if(document){
								ev.emit('data', document);
							}
							setImmediate(fetch_reentrant);
						}
						else{
							ev.emit('error', err);
						}
					});
				};
				fetch_reentrant();
			});
		});
	});
	return ev;
};

testPoller().on('data', function(document){
	console.log('Emitted document caught:', document);
});