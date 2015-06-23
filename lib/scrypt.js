var config = require('../config')
	, scrypt;

switch (config.scrypt) {
	case 'CUSTOM':
		scrypt = require('../scrypt/scrypt');
		module.exports = scrypt.scrypt;
		break;
	default:
		scrypt = require('scrypt');
		module.exports = function(buffer) {
			return scrypt.kdf(buffer, { N: 1024, r: 1, p: 1 }, 32, buffer).hash;
		};
		break;
}
