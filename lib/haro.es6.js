/**
 * Harō is modern DataStore that can be wired to an API
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015 
 * @license BSD-3-Clause
 * @link https://github.com/avoidwork/haro
 * @version 1.0.0
 */
( function ( global ) {
const tuple = global.tuple || require( "tiny-tuple" );
const Promise = global.Promise || require( "es6-promise" ).Promise;
const Map = global.Map || require( "es6-map" );
const fetch = global.fetch || require( "node-fetch" );

function clone ( arg ) {
	return JSON.parse( JSON.stringify( arg ) );
}

function deferred () {
	let promise, pResolve, pReject;

	promise = new Promise( function ( resolve, reject ) {
		pResolve = resolve;
		pReject = reject;
	} );

	return { resolve: pResolve, reject: pReject, promise: promise };
}

function merge ( a, b ) {
	let c = clone( a ),
		d = clone( b );

	Object.keys( d ).forEach( function ( i ) {
		c[ i ] = d[ i ];
	} );

	return c;
}

function uuid () {
	let r = [ 8, 9, "a", "b" ];

	function s () {
		return ( ( ( 1 + Math.random() ) * 0x10000 ) | 0 ).toString( 16 ).substring( 1 );
	}

	return ( s() + s() + "-" + s() + "-4" + s().substr( 0, 3 ) + "-" + r[ Math.floor( Math.random() * 4 ) ] + s().substr( 0, 3 ) + "-" + s() + s() + s() );
}

class Haro {
	constructor ( data ) {
		this.data = new Map();
		this.config = {
			method: "get",
			credentials: false,
			headers: {
				accept: "application/json",
				"content-type": "application/json"
			}
		};
		this.registry = [];
		this.key = "";
		this.source = "";
		this.total = 0;
		this.uri = "";

		if ( data ) {
			this.batch( data, "set" );
		}
	}

	batch ( args, type ) {
		let defer = deferred(),
		    promises = [];

		if ( type === "del" ) {
			args.forEach( i => {
				 promises.push( this.del( i, true ) );
			} );
		} else {
			args.forEach( i => {
				promises.push( this.set( null, i, true ) );
			} );
		}

		Promise.all( promises ).then( function ( arg ) {
			defer.resolve( arg );
		}, function ( e ) {
			defer.reject( e.message || e );
		} );

		return defer.promise;
	}

	clear () {
		this.total = 0;
		this.registry = [];
		this.data.clear();

		return this;
	}

	del ( key, batch=false ) {
		let defer = deferred(),
			index;

		let next = () => {
			index = this.registry.indexOf( key );

			if ( index > -1 ) {
				if ( index === 0 ) {
					this.registry.shift();
				} else if ( index === ( this.registry.length - 1 ) ) {
					this.registry.pop();
				} else {
					this.registry.splice( index, 1 );
				}

				this.data.delete( key );
				--this.total;
			}

			defer.resolve();
		};

		if ( this.data.has( key ) ) {
			if ( !batch && this.uri ) {
				this.request( this.uri.replace( /\?.*/, "" ) + "/" + key, {method: "delete"} ).then( next, function ( e ) {
					defer.reject( e.message || e );
				});
			} else {
				next()
			}
		} else {
			defer.reject( new Error( "Record not found" ) );
		}

		return defer.promise;
	}

	entries () {
		return this.data.entries();
	}

	forEach ( fn, ctx ) {
		return this.data.forEach( fn, ctx );
	}

	get ( key ) {
		let output;

		if ( this.data.has( key ) ) {
			output = tuple( key, this.data.get( key ) );
		}

		return output;
	}

	keys () {
		return this.data.keys();
	}

	limit ( start=0, offset=1 ) {
		let i = start,
		    nth = start + offset,
		    list = [];

		if ( i === nth || i > nth || nth > this.total ) {
			throw new Error( "Invalid range" );
		}

		do {
			list.push( this.get( this.registry[ i ] ) );
		} while ( ++i < nth );

		return tuple.apply( tuple, list );
	}

	request ( input, config={} ) {
		let cfg = merge( this.config, config );

		return fetch( input, cfg ).then( function( res ) {
			return res[ cfg.headers.accept === "application/json" ? "json" : "text" ]();
		}, function ( e ) {
			throw e;
		} );
	}

	set ( key, data, batch=false, override=false ) {
		let defer = deferred(),
		    method = "post",
		    ldata = clone( data );

		if ( key === undefined || key === null ) {
			key = this.key ? ldata[ this.key ] : uuid() || uuid();
		} else if ( this.data.has( key ) ) {
			method = "put";

			if ( !override ) {
				ldata = merge( this.get( key )[ 1 ], ldata );
			}
		}

		if ( !batch && this.uri ) {
			this.request( this.uri.replace( /\?.*/, "" ) + "/" + key, { method: method, body: JSON.stringify( ldata ) } ).then( () => {
				this.data.set( key, ldata );
				this.registry.push( key );
				++this.total;
				defer.resolve( this.get( key ) );
			}, function ( e ) {
				defer.reject( e.message || e );
			} );
		} else {
			this.data.set( key, ldata );
			this.registry.push( key );
			++this.total;
			defer.resolve( this.get( key ) );
		}

		return defer.promise;
	}

	setUri ( uri ) {
		let defer = deferred();

		this.uri = uri;

		if ( this.uri ) {
			this.request( this.uri ).then( arg => {
				let data = arg;

				if ( this.source ) {
					try {
						this.source.split( "." ).forEach( function ( i ) {
							data = data[ i ];
						} );
					} catch ( e ) {
						return defer.reject( e );
					}
				}

				this.batch( data, "set" ).then( function ( records ) {
					defer.resolve( records );
				}, function ( e ) {
					defer.reject( e.message || e );
				} );
			}, function ( e ) {
				defer.reject( e.message || e );
			} )
		} else {
			defer.resolve();
		}

		return defer.promise;
	}

	values () {
		return this.data.values();
	}
}

function factory ( data=null, config={} ) {
	return new Haro( data, config );
}

// Node, AMD & window supported
if ( typeof exports !== "undefined" ) {
	module.exports = factory;
} else if ( typeof define === "function" ) {
	define( function () {
		return factory;
	} );
} else {
	global.haro = factory;
}
} )( typeof global !== "undefined" ? global : window );
