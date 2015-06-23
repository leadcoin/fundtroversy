module.exports = {
	// Which implementation of Scrypt to use
	// NPM:SCRYPT uses the 'scrypt' package from NPM
	// CUSTOM uses the one located in the 'scrypt' subdirectory; it must be compiled to use
	scrypt: 'NPM:SCRYPT'
	// Google Analytics tracking ID
	, analytics: 'UA-00000000-0'
	// The maximum amount of time before a connection is closed when polling for new work, in milliseconds
	, pollTimeout: 30 * 1000
	// If a job is probably no longer valid, don't bother submitting it; may clash with some types of load balancing
	, rejectAssumedStales: true
	// The default port for the API server; it can also be set using the NODE_PORT or PORT environment variables, which will override this setting
	, server: {
		port: 9876
	}
	// The pool you're connecting to; set active to false when developing so you don't constantly disconnect and reconnect
	, stratum: {
		host: ''
		, port: 3333
		, username: ''
		, password: ''
		, active: true
	}
};
