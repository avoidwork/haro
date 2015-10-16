function factory (data = null, config = {}, indexes = []) {
	let obj = new Haro(data, config, indexes),
		functions;

	if (webWorker) {
		functions = [
			cast.toString(),
			clone.toString(),
			createIndexes.toString(),
			each.toString(),
			iterate.toString(),
			joinData.toString(),
			keyIndex.toString(),
			setIndexValue.toString(),
			setIndex.toString(),
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
