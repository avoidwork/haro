/**
 * Streaming support for large datasets
 */
export class DataStream {
	/**
	 * @param {Iterator} iterator - Data iterator
	 * @param {Object} [options={}] - Stream options
	 */
	constructor (iterator, options = {}) {
		this.iterator = iterator;
		this.options = {
			batchSize: 1000,
			bufferSize: 10000,
			...options
		};
		this.buffer = [];
		this.ended = false;
		this.position = 0;
	}

	/**
	 * Read next batch of records
	 * @param {number} [size] - Batch size
	 * @returns {Promise<Record[]>} Array of records
	 */
	async read (size = this.options.batchSize) {
		const batch = [];

		while (batch.length < size && !this.ended) {
			const { value, done } = this.iterator.next();

			if (done) {
				this.ended = true;
				break;
			}

			batch.push(value);
			this.position++;
		}

		return batch;
	}

	/**
	 * Read all remaining records
	 * @returns {Promise<Record[]>} All records
	 */
	async readAll () {
		const records = [];

		while (!this.ended) {
			const batch = await this.read();
			records.push(...batch);
		}

		return records;
	}

	/**
	 * Apply transformation to stream
	 * @param {Function} transform - Transform function
	 * @returns {DataStream} New transformed stream
	 */
	map (transform) {
		const transformedIterator = {
			next: () => {
				const { value, done } = this.iterator.next();

				return done ? { done: true } : { value: transform(value), done: false };
			}
		};

		return new DataStream(transformedIterator, this.options);
	}

	/**
	 * Filter stream records
	 * @param {Function} predicate - Filter predicate
	 * @returns {DataStream} New filtered stream
	 */
	filter (predicate) {
		const filteredIterator = {
			next: () => {
				while (true) {
					const { value, done } = this.iterator.next();
					if (done) return { done: true };
					if (predicate(value)) return { value, done: false };
				}
			}
		};

		return new DataStream(filteredIterator, this.options);
	}

	/**
	 * Take limited number of records
	 * @param {number} limit - Maximum records
	 * @returns {DataStream} New limited stream
	 */
	take (limit) {
		let count = 0;
		const limitedIterator = {
			next: () => {
				if (count >= limit) return { done: true };
				const { value, done } = this.iterator.next();
				if (done) return { done: true };
				count++;

				return { value, done: false };
			}
		};

		return new DataStream(limitedIterator, this.options);
	}

	/**
	 * Get stream statistics
	 * @returns {Object} Stream statistics
	 */
	getStats () {
		return {
			position: this.position,
			ended: this.ended,
			bufferSize: this.buffer.length,
			options: this.options
		};
	}
}
