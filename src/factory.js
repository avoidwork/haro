function factory (data = null, config = {}, indexes = []) {
	let obj = new Haro(data, config, indexes),
		functions;

	if (webWorker) {
		functions = [
			createIndexes.toString(),
			keyIndex.toString(),
			setIndexValue.toString(),
			setIndex.toString(),
			cast.toString(),
			"onmessage = " + onmessage.toString() + ";"
		];

		try {
			obj.worker = global.URL.createObjectURL(blob(functions.join("\n")));
		} catch (e) {
			obj.worker = null;
		}
	}

	return obj;
}

factory.transform = cast;
factory.version = "{{VERSION}}";
