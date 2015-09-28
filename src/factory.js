function factory (data = null, config = {}, indexes = []) {
	let obj = new Haro(data, config, indexes),
		functions;

	if (webWorker) {
		functions = [
			clone.toString(),
			createIndexes.toString(),
			keyIndex.toString(),
			iterate.toString(),
			merge.toString(),
			setIndexValue.toString(),
			setIndex.toString(),
			transform.toString()
		];

		try {
			obj.worker = global.URL.createObjectURL(blob(functions.join("\n")));
		} catch (e) {
			obj.worker = null;
		}
	}

	return obj;
}

factory.version = "{{VERSION}}";
