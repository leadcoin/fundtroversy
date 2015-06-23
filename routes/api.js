var http = require('http');
var crypto = require('crypto');

var log = require('../lib/log');
var store = require('../lib/work');
var config = require('../config');
var generate = require('../lib/generate');
var scrypt = require('../lib/scrypt');

function middleware(req, res, next) {
	var send = res.send;
	
	res.send = function(body) {
		res.send = send;
		
		var status = 200;
		
		// Get everything in the proper variable
		if (arguments.length == 2) {
			if (typeof body !== 'number' && typeof arguments[1] === 'number') {
				status = arguments[1];
			} else {
				status = body;
				body = arguments[1];
			}
		}
		
		// If it's just a number, send the default message
		if (arguments.length == 1 && typeof body === 'number') {
			status = body;
			body = http.STATUS_CODES[body];
		}
		
		// Send it as an error or result
		res.send(status, {
			status: status
			, error: (status == 200 ? null : body)
			, result: (status == 200 ? body : null)
		});
	};
	
	next();
}

var workCache;
var workPolls = [];
if (generate.available) generate.onWork(function(data) {
	log.info('Got New Work');
	
	workCache = data;
	
	// Only bother sending work to those polling if we're cleaning
	if (!data.cleanJobs) return;
	
	for (var i = 0; i < workPolls.length; i += 1) {
		if (!workPolls[i].connection.destroyed) {
			// No need to send the default false
			clearTimeout(workPolls[i].pollTimeout);
			
			// Send them some work!
			sendWork(workPolls[i]);
		}
	}
	
	workPolls.length = 0;
});

function sha256crypto(buffer) {
	var hash = crypto.createHash('sha256');
	hash.update(buffer);
	return hash.digest();
}

function seb(buf) {
	var r = new Buffer(buf.length);
	
	for (var i = 0; i < Math.floor(buf.length / 4); i += 1) {
		r[i * 4] = buf[i * 4 + 3];
		r[i * 4 + 1] = buf[i * 4 + 2];
		r[i * 4 + 2] = buf[i * 4 + 1];
		r[i * 4 + 3] = buf[i * 4];
	}
	
	return r;
}

function seh(hex) {
	return seb(new Buffer(hex, 'hex')).toString('hex');
}

function sendWork(res) {
	var hr = workCache;
	
	// Create the coinbase
	var extraNonce2Hex = crypto.pseudoRandomBytes(hr.extraNonceSize).toString('hex');
	var coinbase = new Buffer(hr.coinBase1 + hr.extraNonce + extraNonce2Hex + hr.coinBase2, 'hex');
	
	// Figure out the merkle root
	var merkleRoot = sha256crypto(sha256crypto(coinbase));
	for (var i = 0, b; i < hr.merkleBranch.length; i += 1) {
		b = new Buffer(hr.merkleBranch[i], 'hex');
		merkleRoot = sha256crypto(sha256crypto(Buffer.concat([merkleRoot, b])));
	}
	
	// Create the header
	var header = seh(hr.version) + seh(hr.previousHash) + merkleRoot.toString('hex') + seh(hr.time) + seh(hr.bits);
	
	// Save it as valid work to the database
	store.setWork(header, 1800, {
		job: hr.jobId
		, extraNonce2: extraNonce2Hex
	});

	// Send it to the client
	res.send(header);
}

// Polls (if ?poll=true) for work or send immediately
function work(req, res) {
	if (req.query.poll == 'true') {
		// Limit the connection time before just returning a false
		res.pollTimeout = setTimeout((function(){
			this.send(false);
			
			// Remove it from the list of connections to reply to
			var idx = workPolls.indexOf(this);
			if (idx >= 0) workPolls.splice(idx, 1);
		}).bind(res), config.pollTimeout);
		
		workPolls.push(res);
		return;
	}
	
	if (!workCache) return res.send(false);
	
	sendWork(res);
}

function hexLesserOrEqualTo(a, b) {
	var i, j, k, x;
	for (i = 0, x = Math.min(a.length, b.length); i < x; i += 1) {
		j = parseInt(a[i], 16);
		k = parseInt(b[i], 16);
		
		if (j < k) return true;
		if (j > k) return false;
	}
	
	return true;
}

function bigIntToHex(int, length) {
	var r = int.toString(16);
	
	while (r.length < length) {
		r = ('0' + r);
	}
	
	return r;
}

function submit(req, res) {
	// TODO: Check if the user IP is blocked
	// TODO: Check if the user session is blocked
	// TODO: Check if the user has a high reputation

	// Return as fast as possible
	res.send(true);
	
	// Gather up the data
	var userHeader = req.body.header;
	var userScrypt = req.body.scrypt;
	
	// Validate
	if (!(/^([a-f0-9]{160})$/).test(userHeader)) return;
	if (!(/^([a-f0-9]{64})$/).test(userScrypt)) return;

	// Check if that header could have come from that work data
	var myData = userHeader.substr(0, 152);
	
	// Check if it's work I sent out
	store.getWork(myData, function(err, work) {
		if (err) return log.error(err);
		if (!work) return;

		// Reverse the hex
		var scryptRev = '';
		for (var i = 62; i >= 0; i -= 2) {
			scryptRev += userScrypt.substr(i, 2)
		}
		
		// Check if the scrypt is less than the pool target
		var targetHex = bigIntToHex(0x0000ffff00000000000000000000000000000000000000000000000000000000 / generate.difficulty, 64);
		
		if (hexLesserOrEqualTo(scryptRev, targetHex)) {

			log.info('Checking Share');

			// Check if the scrypt matches
			var headerBuffer = new Buffer(userHeader, 'hex');
			var myScrypt = scrypt(headerBuffer).toString('hex');

			if (userScrypt != myScrypt) return log.info('Failed Scrypt Test');

			// Reverse the nonce
			var nonceRev = seh(userHeader.substr(152, 8));

			// Reverse the time
			var timeRev = seh(myData.substr(136, 8));

			// Prep the work
			var params = [
				config.stratum.username
				, work.job
				, work.extraNonce2
				, timeRev
				, nonceRev
			];

			// Send the work
			generate.submitWork(params, function(err) {
				if (err) return log.error('Share Rejected', err);

				log.info('Share Accepted');
			});
		}
	});
}

exports.middleware = middleware;

exports.work = work;
exports.submit = submit;
