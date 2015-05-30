function merge ( a, b ) {
	let c = clone( a ),
		d = clone( b );

	Object.keys( d ).forEach( function ( i ) {
		c[ i ] = d[ i ];
	} );

	return c;
}
