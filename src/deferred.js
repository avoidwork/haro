function deferred () {
	let promise, pResolve, pReject;

	promise = new Promise( function ( resolve, reject ) {
		pResolve = resolve;
		pReject = reject;
	} );

	return { resolve: pResolve, reject: pReject, promise: promise };
}
