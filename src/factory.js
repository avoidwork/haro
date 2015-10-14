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
			joinData.toString(),
			(!server ? "" : "self.") + "onmessage = " + onmessage.toString() + ";"
		];

		try {
			obj.worker = !server ? global.URL.createObjectURL(blob(functions.join("\n"))) : new Function(functions.join("\n"));
		} catch (e) {
			obj.worker = null;
		}
	}

	return obj;
}

factory.transform = cast;
factory.version = "{{VERSION}}";
