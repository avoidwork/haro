	function factory (data = null, config = {}) {
		const obj = new Haro(config);

		if (webWorker) {
			obj.worker = node === false ? global.URL.createObjectURL(blob(functions)) : new Function(functions);
		}

		if (Array.isArray(data)) {
			obj.batch(data, "set");
		}

		return obj;
	}

	factory.version = "{{VERSION}}";
