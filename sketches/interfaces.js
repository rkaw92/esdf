/**
 * Configure the Interface constructor so that it may behave differently from the default.
 * @param {Object} [options] Configuration options impacting the Interface functionality.
 * @returns {function(new:Interface, string, Array)} The customized constructor.
 */
function customize(options){
	options = options || {};
	
	function InterfaceMethodArgument(name, type){
		if(!(this instanceof InterfaceMethodArgument)){
			return new InterfaceMethodArgument(name, type);
		}
		this.name = name;
		this.type = type;
	}

	function InterfaceMethod(name, formalParameters, returnType){
		if(!(this instanceof InterfaceMethod)){
			return new InterfaceMethod(name, fo);
		}
		this.name = name;
		this.arguments = arguments;
		this.returnType = returnType;
	}

	function Interface(name, methods){
		if(!(this instanceof Interface)){
			return new Interface(name, methods);
		}
		this.name = name;
		this.methods = methods;
		this.backend = new (this.decoratorImplementation)();
	}
	Interface.prototype.registerImplementation = function registerImplementation(implementor){
		this.backend.registerImplementation(implementor);
	};
	Interface.prototype.checkImplementation = function checkImplementation(supposedImplementor){
		return this.backend.checkImplementation(supposedImplementor);
	};

	var decoratorImplementations = {
		/**
		* Preferred decorator back-end, leaves no mark on the object and is guaranteed to be safe in all circumstances wherever ECMAScript 6 is supported.
		*/
		WeakMap: function WeakMapDecorator(){
			this.implementors = new WeakMap();
			this.registerImplementation = function registerImplementation(implementor){
				var referenceObject = (typeof(implementor) === 'function') ? implementor.prototype : implementor;
				this.implementors.set(referenceObject, true);
			};
			
			this.checkImplementation = function checkImplementation(supposedImplementor){
				try{
					// True iff the inspected object or its prototype is a recognized implementor.
					return Boolean(this.implementors.get(supposedImplementor) || this.implementors.get(Object.getPrototypeOf(supposedImplementor)));
				}
				catch(error){
					return false;
				}
			};
		},
		/**
		* Fallback implementation for ECMAScript 5 - modifies the marked object's prototype (or the object itself, if not a function or if a prototype is absent).
		*/
		Prototype: function PrototypeDecorator(){
			this.registerImplementation = function registerImplementation(implementor){
				var referenceObject = (typeof(implementor) === 'function') ? implementor.prototype : implementor;
				if(!(referenceObject._implementedInterfaces)){
					referenceObject._implementedInterfaces = [];
				}
				referenceObject._implementedInterfaces.push(this);
			};
			this.checkImplementation = function checkImplementation(supposedImplementor){
				try{
					return Boolean(supposedImplementor._implementedInterfaces.indexOf(this) >= 0 || Object.getPrototypeOf(supposedImplementor)._implementedInterfaces.indexOf(this) >= 0);
				}
				catch(error){
					return false;
				}
			};
		}
	};
	
	// Determine the decorator implementation to use.
	if(options.backend){
		// The customizer has requested that a specific backend be used. Evaluate its demands.
		if(decoratorImplementations.hasOwnProperty(options.backend)){
			Interface.prototype.decoratorImplementation = decoratorImplementations[options.backend];
		}
		else if(typeof(options.backend) === 'object' && options.backend !== null && typeof(options.backend.registerImplementation) === 'function' && typeof(options.backend.checkImplementation) === 'function'){
			Interface.prototype.decoratorImplementation = options.backend;
		}
		else{
			throw new Error('Invalid interface decorator backend supplied: ' + options.backend);
		}
	}
	else{
		// Select according to preference.
		var backendName = (typeof(WeakMap) === 'function') ? 'WeakMap' : 'Prototype';
		Interface.prototype.decoratorImplementation = decoratorImplementations[backendName];
	}
	
	
	return Interface;
}
module.exports = customize();
module.exports.customize = customize;