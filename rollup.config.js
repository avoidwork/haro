import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import { visualizer } from "rollup-plugin-visualizer";
import filesize from "rollup-plugin-filesize";
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
// Environment detection
const isAnalyze = process.env.ANALYZE === "true";

// Base configurations with enhanced options
const defaultOutBase = {
	compact: true,
	banner: bannerLong,
	name: pkg.name,
	generatedCode: {
		// Use modern JavaScript features for better tree shaking
		arrowFunctions: true,
		constBindings: true,
		objectShorthand: true
	}
};

const cjOutBase = {
	...defaultOutBase,
	compact: false,
	format: "cjs",
	exports: "named",
	interop: "compat"
};

const esmOutBase = {
	...defaultOutBase,
	format: "esm",
	exports: "named"
};

const umdOutBase = {
	...defaultOutBase,
	format: "umd"
};

const minOutBase = {
	banner: bannerShort,
	name: pkg.name,
	plugins: [
		terser({
			compress: {
				pure_getters: true,
				unsafe_comps: true,
				unsafe_math: true,
				passes: 2
			},
			mangle: {
				properties: {
					regex: /^_/
				}
			}
		})
	],
	sourcemap: true
};

// Shared plugins configuration
const getPlugins = () => {
	const plugins = [
		// Replace environment variables
		replace({
			preventAssignment: true,
			values: {
				"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
				"__VERSION__": JSON.stringify(pkg.version)
			}
		}),

		// Enhanced module resolution
		resolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true
		}),

		// Handle CommonJS modules
		commonjs({
			include: /node_modules/
		}),

		// Handle JSON imports
		json(),

		// File size reporting
		filesize({
			showMinifiedSize: false,
			showGzippedSize: true
		})
	];

	// Add bundle analyzer in analyze mode
	if (isAnalyze) {
		plugins.push(
			visualizer({
				filename: "bundle-analysis.txt",
				template: "list",
				gzipSize: true,
				brotliSize: true
			})
		);
	}

	return plugins;
};


export default [
	{
		input: `./src/${pkg.name}.js`,
		external: ["crypto"],

		// Advanced tree shaking configuration
		treeshake: {
			moduleSideEffects: false,
			propertyReadSideEffects: false,
			tryCatchDeoptimization: false,
			unknownGlobalSideEffects: false
		},

		// Cache configuration for faster builds
		cache: true,

		// Enhanced warnings handling
		onwarn (warning, warn) {
			// Suppress specific warnings since we're targeting environments where crypto is a global
			if (warning.code === "MISSING_NODE_BUILTINS" ||
				warning.code === "MIXED_EXPORTS" && warning.message.includes("src/haro.js") ||
				warning.code === "CIRCULAR_DEPENDENCY") {
				return;
			}
			warn(warning);
		},

		plugins: getPlugins(),

		output: [
			{
				...cjOutBase,
				file: `dist/${pkg.name}.cjs`
			},
			{
				...esmOutBase,
				file: `dist/${pkg.name}.js`,
				globals: { crypto: "crypto" }
			},
			{
				...esmOutBase,
				...minOutBase,
				file: `dist/${pkg.name}.min.js`,
				globals: { crypto: "crypto" }
			},
			{
				...umdOutBase,
				file: `dist/${pkg.name}.umd.js`,
				name: "haro",
				globals: { crypto: "crypto" }
			},
			{
				...umdOutBase,
				...minOutBase,
				file: `dist/${pkg.name}.umd.min.js`,
				name: "haro",
				globals: { crypto: "crypto" }
			}
		]
	}
];
