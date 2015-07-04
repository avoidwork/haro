const adapters = {
	cmd: function (type, store, ...args) {
		let defer = deferred();

		if (!store.adapters[type]) {
			defer.reject(new Error(type + " not configured for persistent storage"));
		} else {
			adapters[type].apply(adapters, [store].concat(args)).then(function (arg) {
				defer.resolve(arg);
			}, function (e) {
				defer.reject(e);
			});
		}

		return defer.promise;
	},
	mongo: function (store, op, key, data) {
		let defer = deferred(),
			record = key !== undefined && store.has(key);

		mongodb.connect(store.adapters.mongo, function (e, db) {
			function error (errr, arg) {
				if (db) {
					db.close();
				}

				if (errr) {
					defer.reject(errr);
				} else {
					defer.resolve(arg);
				}
			}

			if (e) {
				error(e);
			} else {
				db.collection(store.id, function (err, collection) {
					if (err) {
						error(err);
					} else {
						if (op === "get") {
							if (record) {
								collection.find({_id: key}).limit(1).toArray(function (errr, recs) {
									db.close();

									if (errr) {
										defer.reject(errr);
									} else if (recs.length === 0) {
										defer.resolve(null);
									} else {
										delete recs[0]._id;

										store.set(key, recs[0], true).then(function (rec) {
											defer.resolve(rec);
										}, function (errrr) {
											defer.reject(errrr);
										});
									}
								});
							} else {
								collection.find({}).toArray(function (errr, recs) {
									db.close();

									if (errr) {
										defer.reject(errr);
									} else {
										store.batch(recs.map(function (i) {
											let o = i;

											delete o._id;
											return o;
										}), "set", true).then(function (args) {
											defer.resolve(args);
										}, function (errrr) {
											defer.reject(errrr);
										});
									}
								});
							}
						}

						if (op === "remove") {
							collection.remove(record ? {_id: key} : {}, {safe: true}, function (errr, arg) {
								db.close();

								if (errr) {
									defer.reject(errr);
								} else {
									defer.resolve(arg);
								}
							});
						}

						if (op === "set") {
							if (record) {
								collection.update({_id: key}, data, {
									w: 1,
									safe: true,
									upsert: true
								}, error);
							} else {
								// Removing all documents & re-inserting
								collection.remove({}, {w: 1, safe: true}, function (errr) {
									let deferreds;

									if (errr) {
										error(errr);
									} else {
										deferreds = [];

										store.forEach(function (v, k) {
											let defer2 = deferred();

											deferreds.push(defer2.promise);

											collection.update({_id: k}, v, {
												w: 1,
												safe: true,
												upsert: true
											}, function (errrr, arg) {
												if (errrr) {
													defer2.reject(errrr);
												} else {
													defer2.resolve(arg);
												}
											});
										});

										Promise.all(deferreds).then(function (result) {
											db.close();
											defer.resolve(result);
										}, function (errrr) {
											db.close();
											defer.reject(errrr);
										});
									}
								});
							}
						} else {
							db.close();
							defer.reject(null);
						}
					}
				});
			}
		});

		return defer.promise;
	}
};
