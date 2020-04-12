	function factory (data = null, config = {}) {
		const obj = new Haro(config);

		if (Array.isArray(data)) {
			obj.batch(data, "set");
		}

		return obj;
	}

	factory.version = "{{VERSION}}";
