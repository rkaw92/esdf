var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
var when = require('when');
var compositor = require('app-compositor');
var MongoStore = require('esdf-store-mongo');

function MongoDatabase(){
	this.is('MongoDatabase');
	this.provides('MongoDatabase', function(dependencies){
		var client = new MongoClient(new MongoServer('localhost', 45555));
		return when.promise(function openMongoClient(resolve, reject){
			client.open(function getMongoDatabase(error, connection){
				if(error){
					reject(error);
					return;
				}
				resolve(connection.db('test'));
			});
		});
	});
}

function MongoCollection(){
	this.is('MongoCollection');
	this.requires('MongoDatabase');
	this.provides('MongoCollection', function(dependencies){
		return when.promise(function getCollection(resolve, reject){
			dependencies.MongoDatabase.collection('EventStore', function(error, collection){
				if(error){
					reject(error);
					return;
				}
				resolve(collection);
			});
		});
	});
}

function MongoEventStore(){
	this.is('MongoEventStore');
	this.requires('MongoCollection');
	this.provides('MongoEventStore', function(dependencies){
		return new MongoStore(dependencies.MongoCollection);
	});
}

function test(){
	this.is('test');
	this.requires('MongoEventStore');
	this.provides('test', function(dependencies){
		var store = dependencies.MongoEventStore;
		return store.streamSequenceCommits('SEQUENCE-1', 1, function displayCommitData(commit){
			console.info('* Commit [%s:%s]:', commit.sequenceID, commit.sequenceSlot, commit.events);
		});
	});
}

var manager = new compositor.CompositionManager();
manager.runModules([ MongoDatabase, MongoCollection, MongoEventStore, test ]).done(function(){
	console.info('* RUN: success!');
});