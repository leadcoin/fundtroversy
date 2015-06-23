var path = require('path');
var express = require('express');

var log = require('./lib/log');
var config = require('./config');
var routes = require('./routes');

var app = express();

//

app.locals.public_version = 2;
app.locals.analytics = config.analytics;

app.use(express.cookieParser());

app.use('/public', express.static(path.join(__dirname, 'public')));

app.configure('development', function() {
	log.info('Using Development Environment');

	app.use('/', express.static(path.join(__dirname, 'demo')));
	app.use(express.logger('dev'));
});

app.configure('production', function() {
	log.info('Using Production Environment');
	
	app.enable('trust proxy');
});

app.get('/api/work', routes.api.middleware, routes.api.work);

app.post('/api/submit', routes.api.middleware, express.urlencoded(), routes.api.submit);

var port = (process.env.NODE_PORT || process.env.PORT || config.server.port);
app.listen(port);
process.title = 'sv' + port;
