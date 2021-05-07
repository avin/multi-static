const fs = require('fs-extra');

module.exports = {
  http: {
    port: 3003,
    https: true,
    key: fs.readFileSync('./node_modules/localhost-certs/files/server.key', 'utf8'),
    cert: fs.readFileSync('./node_modules/localhost-certs/files/server.crt', 'utf8'),
  },
  mapping: [
    ['./static/folder1', '/root'],
    ['./static/_common', '/root'],
  ],
  welcomeMessage: 'hello from folder1.config',
};
