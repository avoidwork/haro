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
		this.versions = new Map();

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
			defer.reject( e );
		} );

		return defer.promise;
	}

	clear () {
		this.total = 0;
		this.registry = [];
		this.data.clear();
		this.versions.clear();

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
				this.versions.delete( key );
				--this.total;
			}

			defer.resolve();
		};

		if ( this.data.has( key ) ) {
			if ( !batch && this.uri ) {
				this.request( this.uri.replace( /\?.*/, "" ) + "/" + key, {method: "delete"} ).then( next, function ( e ) {
					defer.reject( e );
				} );
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

	filter ( fn ) {
		let result = [];

		this.forEach( function ( i ) {
			if ( fn( i ) === true ) {
				result.push( i );
			}
		} );

		return tuple.call( tuple, result );
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

	limit ( start=0, offset=0 ) {
		let i = start,
		    nth = start + offset,
		    list = [],
		    k;

		if ( i < 0 || i >= nth ) {
			throw new Error( "Invalid range" );
		}

		do {
			k = this.registry[ i ];

			if ( k ) {
				list.push( this.get( k ) );
			}
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
		    ldata = clone( data ),
			next;

		next = () => {
			if (method === "post" ) {
				++this.total;
				this.registry.push( key );
				this.versions.set( key, new Set() );
			} else {
				this.versions.get( key ).add( tuple( this.data.get( key ) ) );
			}

			this.data.set( key, ldata );
			defer.resolve( this.get( key ) );
		};

		if ( key === undefined || key === null ) {
			key = this.key ? ldata[ this.key ] : uuid() || uuid();
		} else if ( this.data.has( key ) ) {
			method = "put";

			if ( !override ) {
				ldata = merge( this.get( key )[ 1 ], ldata );
			}
		}

		if ( !batch && this.uri ) {
			this.request( this.uri.replace( /\?.*/, "" ) + "/" + key, { method: method, body: JSON.stringify( ldata ) } ).then( next, function ( e ) {
				defer.reject( e );
			} );
		} else {
			next();
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
					defer.reject( e );
				} );
			}, function ( e ) {
				defer.reject( e );
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
