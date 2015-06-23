module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json')
		, uglify: {
			main: {
				files: {
					'public/main.js': ['raw/util.js', 'raw/coordinator.js']
				}
			}
			, worker: {
				files: {
					'public/worker.part.js': 'raw/worker.js'
				}
			}
		}
		, concat: {
			worker: {
				src: ['scrypt/module.min.js', 'public/worker.part.js']
				, dest: 'public/worker.js'
			}
		}
		, mkdir: {
			all: {
				options: {
					create: ['store']
				}
			}
		}
		, clean: {
			build: ['public/worker.part.js']
			, all: ['public/worker.js', 'public/main.js', 'store']
		}
		, watch: {
			js: {
				files: ['raw/*.js', 'scrypt/module.min.js']
				, tasks: ['uglify', 'concat', 'clean:build']
			}
		}
	});
	
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-mkdir');
	
	grunt.registerTask('default', ['uglify', 'concat', 'mkdir', 'clean:build']);
};
