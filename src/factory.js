function factory (data = null, config = {}, indexes = []) {
	let obj = new Haro(data, config, indexes),
		fns = [];

	if (webWorker) {
		try {
			obj.worker = global.URL.createObjectURL(blob(fns.join("\n")));
		} catch (e) {
			obj.worker = null;
		}
	}

	return obj;
}

factory.version = "{{VERSION}}";
