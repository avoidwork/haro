import globals from "globals";
import pluginJs from "@eslint/js";

export default [
	// Mocha environment for test files
	{
		files: ["tests/**/*.js"],
		languageOptions: {
			globals: {
				...globals.mocha
			}
		}
	},
	{
		languageOptions: {
			globals: {
				...globals.node,
				it: true,
				describe: true,
				crypto: true
			},
			parserOptions: {
				ecmaVersion: 2022
			}
		},
		rules: {
			"arrow-parens": [2, "as-needed"],
			"arrow-spacing": [2, {"before": true, "after": true}],
			"block-scoped-var": [0],
			"brace-style": [2, "1tbs", {"allowSingleLine": true}],
			"camelcase": [0],
			"comma-dangle": [2, "never"],
			"comma-spacing": [2],
			"comma-style": [2, "last"],
			"complexity": [0, 11],
			"consistent-return": [2],
			"consistent-this": [0, "that"],
			"curly": [2, "multi-line"],
			"default-case": [2],
			"dot-notation": [2, {"allowKeywords": true}],
			"eol-last": [2],
			"eqeqeq": [2],
			"func-names": [0],
			"func-style": [0, "declaration"],
			"generator-star-spacing": [2, "after"],
			"guard-for-in": [0],
			"handle-callback-err": [0],
			"indent": ["error", "tab", {"VariableDeclarator": {"var": 1, "let": 1, "const": 1}, "SwitchCase": 1}],
			"key-spacing": [2, {"beforeColon": false, "afterColon": true}],
			"quotes": [2, "double", "avoid-escape"],
			"max-depth": [0, 4],
			"max-len": [0, 80, 4],
			"max-nested-callbacks": [0, 2],
			"max-params": [0, 3],
			"max-statements": [0, 10],
			"new-parens": [2],
			"new-cap": [2, {"capIsNewExceptions": ["ToInteger", "ToObject", "ToPrimitive", "ToUint32"]}],
			"newline-after-var": [0],
			"newline-before-return": [2],
			"no-alert": [2],
			"no-array-constructor": [2],
			"no-bitwise": [0],
			"no-caller": [2],
			"no-catch-shadow": [2],
			"no-cond-assign": [2],
			"no-console": [0],
			"no-constant-condition": [1],
			"no-continue": [2],
			"no-control-regex": [2],
			"no-debugger": [2],
			"no-delete-var": [2],
			"no-div-regex": [0],
			"no-dupe-args": [2],
			"no-dupe-keys": [2],
			"no-duplicate-case": [2],
			"no-else-return": [0],
			"no-empty": [2],
			"no-eq-null": [0],
			"no-eval": [2],
			"no-ex-assign": [2],
			"no-extend-native": [1],
			"no-extra-bind": [2],
			"no-extra-boolean-cast": [2],
			"no-extra-semi": [1],
			"no-empty-character-class": [2],
			"no-fallthrough": [2],
			"no-floating-decimal": [2],
			"no-func-assign": [2],
			"no-implied-eval": [2],
			"no-inline-comments": [0],
			"no-inner-declarations": [2, "functions"],
			"no-invalid-regexp": [2],
			"no-irregular-whitespace": [2],
			"no-iterator": [2],
			"no-label-var": [2],
			"no-labels": [2],
			"no-lone-blocks": [2],
			"no-lonely-if": [2],
			"no-loop-func": [2],
			"no-mixed-requires": [0, false],
			"no-mixed-spaces-and-tabs": [2, false],
			"no-multi-spaces": [2],
			"no-multi-str": [2],
			"no-multiple-empty-lines": [2, {"max": 2}],
			"no-native-reassign": [0],
			"no-negated-in-lhs": [2],
			"no-nested-ternary": [0],
			"no-new": [2],
			"no-new-func": [0],
			"no-new-object": [2],
			"no-new-require": [0],
			"no-new-wrappers": [2],
			"no-obj-calls": [2],
			"no-octal": [2],
			"no-octal-escape": [2],
			"no-param-reassign": [0],
			"no-path-concat": [0],
			"no-plusplus": [0],
			"no-process-env": [0],
			"no-process-exit": [0],
			"no-proto": [2],
			"no-redeclare": [2],
			"no-regex-spaces": [2],
			"no-reserved-keys": [0],
			"no-reno-new-funced-modules": [0],
			"no-return-assign": [2],
			"no-script-url": [2],
			"no-self-compare": [0],
			"no-sequences": [2],
			"no-shadow": [2],
			"no-shadow-restricted-names": [2],
			"no-spaced-func": [2],
			"no-sparse-arrays": [2],
			"no-sync": [0],
			"no-ternary": [0],
			"no-throw-literal": [2],
			"no-trailing-spaces": [2],
			"no-undef": [2],
			"no-undef-init": [2],
			"no-undefined": [0],
			"no-underscore-dangle": [0],
			"no-unreachable": [2],
			"no-unused-expressions": [2],
			"no-unused-vars": [2, {"vars": "all", "args": "after-used"}],
			"no-use-before-define": [2],
			"no-void": [0],
			"no-warning-comments": [0, {"terms": ["todo", "fixme", "xxx"], "location": "start"}],
			"no-with": [2],
			"no-extra-parens": [2],
			"one-var": [0],
			"operator-assignment": [0, "always"],
			"operator-linebreak": [2, "after"],
			"padded-blocks": [0],
			"quote-props": [0],
			"radix": [0],
			"semi": [2],
			"semi-spacing": [2, {before: false, after: true}],
			"sort-vars": [0],
			"keyword-spacing": [2],
			"space-before-function-paren": [2, {anonymous: "always", named: "always"}],
			"space-before-blocks": [2, "always"],
			"space-in-brackets": [0, "never", {
				singleValue: true,
				arraysInArrays: false,
				arraysInObjects: false,
				objectsInArrays: true,
				objectsInObjects: true,
				propertyName: false
			}],
			"space-in-parens": [2, "never"],
			"space-infix-ops": [2],
			"space-unary-ops": [2, {words: true, nonwords: false}],
			"spaced-line-comment": [0, "always"],
			strict: [0],
			"use-isnan": [2],
			"valid-jsdoc": [0],
			"valid-typeof": [2],
			"vars-on-top": [0],
			"wrap-iife": [2],
			"wrap-regex": [2],
			yoda: [2, "never", {exceptRange: true}]
		}
	},
	pluginJs.configs.recommended
];
