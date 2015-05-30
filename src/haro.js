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