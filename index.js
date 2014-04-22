/* keuw
   Kue Worker Cli Helper

-c concurrency     default 1
-log logfile       default STDOUT
--config           Config directory of config.json, full path to config file or filename in current working directory. Defaults: CWD()/config.json
NODE_CONFIG_DIR    Like --config except defined via environment variable
NODE_ENV           Config JSON in environment variable
*/

function kueWorker(options, cb) {
	var fs               = require('fs')
	var config           = require('config4u')()  // configuration
	var kue              = require('kue')
	var op               = require('oplog')
	var argv             = require('minimist')(process.argv.slice(2))
	var pack             = require('./package.json')
	var logOptions       = {
		ua:        pack.name + '/' + pack.version,
		microtime: true
	}
   var self             = this

	if (!options.ua) {
		var parentPack   = undefined
		try {
			parentPack   = require('../../package.json')
		} catch(e) {}
		if (parentPack) {
			options.ua   = parentPack.name + '/' + parentPack.version
		}
	}

	options              = (options)                                 ? options                          : {}
	logOptions.ua        = (options.ua)                              ? options.ua + ' ' + logOptions.ua : logOptions.ua
	logOptions.microtime = (typeof options.microtime != 'undefined') ? options.microtime                : logOptions.microtime
	var concurrency      = (argv.c) ? argv.c : (options.concurrency) ? options.concurrency              : 1
	var platform         = {}
	var jobs             = kue.createQueue( (config.redis)           ? { redis: config.redis }          : undefined )
	var type             = (options.type)                            ? options.type                     : 'unknown_worker_type'

	op.init(logOptions, function(data) {
		platform = data
		op.log('startup')
		start()
	})

	function start() {
		jobs.process(type, concurrency, function(job, done) {

			function finish() {
				if (argv.v || options.verbose) {
					op.log({ op: 'done', job: job.id, title: job.data.title, run: job.duration })
				}
				done() // success. call with an error message to fail
			}

			try {
				if (argv.v || options.verbose) {
					op.log({ op: 'start', job: job.id, title: job.data.title })
					job.log(op.useragent())
				}
				cb(job, finish, platform)

			} catch(err) {
				if (argv.v || options.verbose) {
					op.log({
						op:         err.name,
						job:        job.id,
						title:      job.data.title,
						error:      err.message,
						errorStack: err.stack
					})
				}
				done(err) // fail on error

            function halt(err) {
               throw new Error(err)
            }
            setTimeout(halt, 10, err)
			}
		})
	}
}

module.exports = kueWorker
