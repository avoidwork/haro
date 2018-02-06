module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		concat: {
			options: {
				banner: "/**\n" +
				" * <%= pkg.description %>\n" +
				" *\n" +
				" * @author <%= pkg.author %>\n" +
				" * @copyright <%= grunt.template.today('yyyy') %>\n" +
				" * @license <%= pkg.license %>\n" +
				" * @version <%= pkg.version %>\n" +
				" */\n"
			},
			dist: {
				src: [
					"src/intro.js",
					"src/utility.js",
					"src/haro.js",
					"src/factory.js",
					"src/outro.js"
				],
				dest: "lib/<%= pkg.name %>.es6.js"
			}
		},
		babel: {
			options: {
				sourceMap: false,
				presets: ["babel-preset-env"]
			},
			dist: {
				files: {
					"lib/<%= pkg.name %>.js": "lib/<%= pkg.name %>.es6.js"
				}
			}
		},
		eslint: {
			target: [
				"Gruntfile.js",
				"lib/<%= pkg.name %>.es6.js",
				"test/*.js"
			]
		},
		nodeunit: {
			all: ["test/*.js"]
		},
		replace: {
			dist: {
				options: {
					patterns: [
						{
							match: /{{VERSION}}/,
							replacement: "<%= pkg.version %>"
						}
					]
				},
				files: [
					{
						expand: true,
						flatten: true,
						src: [
							"lib/<%= pkg.name %>.es6.js"
						],
						dest: "lib/"
					}
				]
			}
		},
		uglify: {
			options: {
				banner: '/* <%= grunt.template.today("yyyy") %> <%= pkg.author %> */\n',
				sourceMap: true,
				sourceMapIncludeSources: true,
				reserved: [
					"Map",
					"Set",
					"Haro",
					"cast",
					"clone",
					"createIndexes",
					"each",
					"iterate",
					"keyIndex",
					"joinData",
					"setIndexValue",
					"setIndex"
				]
			},
			target: {
				files: {
					"lib/<%= pkg.name %>.min.js": ["lib/<%= pkg.name %>.js"]
				}
			}
		},
		watch: {
			js: {
				files: "<%= concat.dist.src %>",
				tasks: "default"
			},
			pkg: {
				files: "package.json",
				tasks: "default"
			}
		}
	});

	// tasks
	grunt.loadNpmTasks("grunt-contrib-concat");
	grunt.loadNpmTasks("grunt-contrib-nodeunit");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-babel");
	grunt.loadNpmTasks("grunt-eslint");
	grunt.loadNpmTasks("grunt-replace");

	// aliases
	grunt.registerTask("test", ["eslint", "nodeunit"]);
	grunt.registerTask("build", ["concat", "replace", "babel", "uglify"]);
	grunt.registerTask("default", ["build", "test"]);
};
