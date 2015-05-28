var $ = require('gulp-load-plugins')(),
	settings = require('./settings.json'),
	tsync = require('run-sequence'),
	bsync = require('browser-sync'),
	gulp = require('gulp'),
	gulpsync = require('gulp-sync')(gulp);
path = require('path'),
	join = path.join,
	fs = require('fs'),
	crypto = require('crypto');

function cacheBoostRename(file, newname) {
	var filecontent = fs.readFileSync(file, {encoding: 'utf8'}), hash;
	if (!filecontent) {
		return;
	}
	hash = crypto.createHash('md5').update(filecontent).digest("hex");
	if (!newname) {
		newname = path.basename(file).replace('minified', 'min');
	}
	newname = [hash.slice(0, 15), newname].join(".");
	gulp.src(file)
		.pipe($.rename(path.join(path.dirname(file), newname)))
		.pipe(gulp.dest("./"));
}
function injectFiles(src, injectTo, dest) {
	if (!dest) {
		dest = path.dirname(injectTo);
	}
	var target = gulp.src(injectTo),
		sources = gulp.src(src, {read: false});
	return target.pipe($.inject(sources, {addPrefix: "", addRootSlash: false}))
		.pipe(gulp.dest(dest));
}

gulp.task('css', $.shell.task(settings.dev_borschik.css));
gulp.task('js', $.shell.task(settings.dev_borschik.js));
gulp.task('cssmin', $.shell.task(settings.prod_borschik.css));
gulp.task('jsmin', $.shell.task(settings.prod_borschik.js));
gulp.task('build', ['css', 'js']);
gulp.task('buildmin', gulpsync.async(['cssmin', 'jsmin']));
gulp.task('clean', function () {
	return gulp.src(settings.clean, {read: false})
		.pipe($.rimraf());
});
gulp.task('cacheboost', function () {
	for (var tech in settings.prod_files) {
		settings.prod_files[tech].forEach(function (filepath, index) {
			cacheBoostRename(filepath);
		});
	}
});
gulp.task('rmnonmin', function () {
	return gulp.src(settings.rmnonmin, {read: false})
		.pipe($.rimraf());
});
gulp.task('prodinject', function () {
	setTimeout(function () {
		injectFiles(settings.prod_files_to_inject.css.concat(settings.prod_files_to_inject.js), settings.injectTo);
	}, 500);
});
gulp.task('devinject', function () {
	injectFiles(settings.dev_files.css.concat(settings.dev_files.js), settings.injectTo);
});

gulp.task('watch', function () {
	var paths = settings.pathToWatch;
	if (paths == undefined || typeof paths !== 'object') {
		return console.warn("settings.pathToWatch is undefined or not an array or object. Nothing to watch.")
	}
	function processFiles(files, blockname, tech, dest) {
		gulp.src(files)
			.pipe($.concat([blockname, tech].join(".")))
			.pipe($.rename([blockname, tech].join(".")))
			.pipe(gulp.dest(dest));
	}

	function watch(dest, blockname, files, tech) {
		if (!dest || typeof blockname == 'undefined' || !files || typeof files !== "object" || !tech) {
			return console.warn("Some of the args in watch function are undefiend!");
		}
		var fullfiles = [];
		files.forEach(function (file) {
			fullfiles.push(join(dest, blockname, file));
		});
		gulp.watch(fullfiles, function () {
			processFiles(fullfiles, blockname, tech, dest);
		});
		processFiles(fullfiles, blockname, tech, dest);
	}

	function processCSS(path, tech) {
		fs.readdir(path, function (err, files) {
			if (err) {
				console.warn("Error when reading %s directory.", path);
				console.error(err)
			}
			files.forEach(function (filename) {
				fs.stat(join(path, filename), function (err, stats) {
					if (err) {
						console.error(err);
						return;
					}
					if (stats.isDirectory()) {
						watch(path, filename, ["*.css"], tech);
					}
				})
			});
		});
	}

	for (var tech in paths) {
		switch (tech) {
			case "css":
				for (var i = 0; i < paths[tech].length; i++) {
					processCSS(paths[tech][i], tech);
				}
				gulp.watch(settings.watch.css, ['css']);
				break;
			case "js":
				gulp.watch(settings.watch.js, ['js']);
				break;
			default:
				console.warn("Technology %s has no resolution algorithm.", tech)
		}
	}
});
gulp.task('sync', function () {
	var files = settings.sync,
		options = {
			notify: true,
			open: false,
			ghostMode: false,
			injectChanges: true,
			logLevel: 'debug',
			minify: false,
			codeSync: true,
			reloadDelay: 500,
			proxy: "localhost:4000"
		};

	bsync.init(files, options, function (err) {
		if (err) throw Error(err);
	});
});

gulp.task('prod', gulpsync.sync(['clean', ['cssmin', 'jsmin'], 'cacheboost', 'rmnonmin', 'prodinject']));
gulp.task('dev', gulpsync.sync(['watch', 'build', 'devinject', 'sync']));