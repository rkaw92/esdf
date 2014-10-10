var Interface = require('./interfaces').Interface;

var ICookie = new Interface('ICookie', [ 'get', 'set' ]);
var Cookie = function Cookie(name, fallbackValue){
	this._name = name;
	this._fallbackValue = fallbackValue;
	this._value = this._fallbackValue;
};
Cookie.prototype.set = function set(value){
	this._value = value;
};
ICookie.registerImplementation(Cookie);
var myCookie = new Cookie();
var badCookie = {};
console.log('* Is myCookie good? %s!', ICookie.checkImplementation(myCookie) ? 'Yes' : 'No');
console.log('* Is badCookie good? %s', ICookie.checkImplementation(badCookie) ? 'Yes': 'No');