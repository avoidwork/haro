	function factory (data = null, config = {}) {
		const obj = new Haro(config).reindex();

		if (webWorker) {
			const functions = [
				cast.toString(),
				clone.toString(),
				createIndexes.toString(),
				each.toString(),
				has.toString(),
				iterate.toString(),
				joinData.toString(),
				keyIndex.toString(),
				setIndex.toString(),
				(node === false ? "" : "self.") + "onmessage = " + onmessage.toString() + ";"
			];

			obj.worker = node === false ? global.URL.createObjectURL(blob(functions.join("\n"))) : new Function(functions.join("\n"));
		}

		if (data) {
			obj.batch(data, "set");
		}

		return obj;
	}

	factory.transform = cast;
	factory.version = "{{VERSION}}";
