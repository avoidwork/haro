const {terser} = require("rollup-plugin-terser");

export default [
	{
		input: "./src/haro.js",
		output: [
			{
				file: "dist/haro.cjs.js",
				format: "cjs",
				exports: "named"
			},
			{
				file: "dist/haro.esm.js",
				format: "es",
				compact: true,
				plugins: [terser()]
			},
			{
				file: "dist/haro.js",
				name: "haro",
				format: "umd",
				compact: true,
				plugins: [terser()]
			}
		]
	}
];
