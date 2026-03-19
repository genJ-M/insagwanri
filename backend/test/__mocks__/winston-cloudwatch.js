'use strict';

const winston = require('winston');

class CloudWatchTransport extends winston.Transport {
  log(info, callback) { callback(); }
}

module.exports = CloudWatchTransport;
