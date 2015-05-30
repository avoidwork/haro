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
				let data = clone( i ),
				    key = this.key ? data[ this.key ] || uuid() : uuid();

				promises.push( this.set( key, data, true ) );
			} );
		}

		Promise.all( promises ).then( function ( arg ) {
			defer.resolve( arg );
		}, function ( e ) {
			defer.reject( e.message || e );
		} );

		return defer.promise;
	}

	del ( key, batch=false ) {
		let defer = deferred();

		if ( this.data.has( key ) ) {
			if ( !batch && this.uri ) {
				this.request( this.uri + "/" + key, {method: "delete"} ).then( function () {
					if ( this.data.has( key ) ) {
						this.data.delete( key );
						--this.total;
					}
					defer.resolve();
				}, function ( e ) {
					defer.reject( e.message || e );
				});
			} else {
				this.data.delete( key );
				--this.total;
				defer.resolve();
			}
		} else {
			defer.reject( "Record not found" );
		}

		return defer.promise;
	}

	get ( key ) {
		let output;

		if ( this.data.has( key ) ) {
			output = tuple( key, this.data.get( key ) );
		}

		return output;
	}

	range ( start=0, end=0 ) {
		let i, n, output;

		if ( start === end || end > start ) {
			throw new Error( "Invalid range" );
		} else {
			i = start - 1;
			n = [];
			do {
				n.push( this.data[ i ] );
			} while ( ++i <= end && i < this.total );
			output = tuple.apply( tuple, n );
		}

		return output;
	}

	request ( input, config={} ) {
		let cfg = merge( this.config, config );

		return fetch( input, cfg ).then( function( res ) {
			return res[ cfg.headers.accept === "application/json" ? "json" : "text" ]().then( function ( data ) {
				return data;
			}, function ( e ) {
				throw e;
			} );
		}, function ( e ) {
			throw e;
		} );
	}

	set ( key, data, batch=false ) {
		let defer = deferred(),
		    method = "post",
		    ldata = clone( data );

		if ( key === undefined || key === null ) {
			key = uuid();
		} else if ( this.data.has( key ) ) {
			method = "put";
			ldata  = merge( this.get( key )[ 1 ], data );
		}

		if ( !batch && this.uri ) {
			this.request( this.uri + "/" + key, { method: method, body: JSON.stringify( ldata ) } ).then( () => {
				this.data.set( key, ldata );
				++this.total;
				defer.resolve( this.get( key ) );
			}, function ( e ) {
				defer.reject( e.message || e );
			} );
		} else {
			this.data.set( key, ldata );
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
				let data = this.source ? arg[ this.source ] : arg;

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
