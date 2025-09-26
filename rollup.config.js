import terser from "@rollup/plugin-terser";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json");
const year = new Date().getFullYear();
const bannerLong = `/**
 * ${pkg.name}
 *
 * @copyright ${year} ${pkg.author}
 * @license ${pkg.license}
 * @version ${pkg.version}
 */`;
const bannerShort = `/*!
 ${year} ${pkg.author}
 @version ${pkg.version}
*/`;
const defaultOutBase = {compact: true, banner: bannerLong, name: pkg.name};
const cjOutBase = {...defaultOutBase, compact: false, format: "cjs", exports: "named"};
const esmOutBase = {...defaultOutBase, format: "esm", exports: "named"};
const umdOutBase = {...defaultOutBase, format: "umd"};
const minOutBase = {banner: bannerShort, name: pkg.name, plugins: [terser()], sourcemap: true};


export default [
	{
		input: `./src/${pkg.name}.js`,
		external: ["crypto"],
		onwarn (warning, warn) {
			// Suppress specific warnings since we're targeting environments where crypto is a global
			if (warning.code === "MISSING_NODE_BUILTINS" ||
				warning.code === "MIXED_EXPORTS" && warning.message.includes("src/haro.js")) {
				return;
			}
			warn(warning);
		},
		output: [
			{
				...cjOutBase,
				file: `dist/${pkg.name}.cjs`
			},
			{
				...esmOutBase,
				file: `dist/${pkg.name}.js`,
				globals: {crypto: "crypto"}
			},
			{
				...esmOutBase,
				...minOutBase,
				file: `dist/${pkg.name}.min.js`,
				globals: {crypto: "crypto"}
			},
			{
				...umdOutBase,
				file: `dist/${pkg.name}.umd.js`,
				name: "haro",
				globals: {crypto: "crypto"}
			},
			{
				...umdOutBase,
				...minOutBase,
				file: `dist/${pkg.name}.umd.min.js`,
				name: "haro",
				globals: {crypto: "crypto"}
			}
		]
	}
];
