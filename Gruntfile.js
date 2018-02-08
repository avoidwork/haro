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
				dest: "lib/<%= pkg.name %>.js"
			}
		},
		eslint: {
			target: [
				"Gruntfile.js",
				"lib/<%= pkg.name %>.js",
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
							"lib/<%= pkg.name %>.js"
						],
						dest: "lib/"
					}
				]
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
	grunt.loadNpmTasks("grunt-eslint");
	grunt.loadNpmTasks("grunt-replace");

	// aliases
	grunt.registerTask("test", ["eslint", "nodeunit"]);
	grunt.registerTask("build", ["concat", "replace"]);
	grunt.registerTask("default", ["build", "test"]);
};
