#!/usr/bin/env node

const argv = require('yargs').argv;
const path = require('path');
const https = require('https');
const _ = require('lodash');
const express = require('express');
const { readConfig } = require('./common');

// Loading user configuration
const config = readConfig(argv.config);

const app = express();

config.beforeDevStart(app);

// Put headers to disable the cache
app.use((_req, res, next) => {
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
});

app.use(async function (req, res, next) {
  for (let [staticPath, serveLocation] of config.mapping) {
    serveLocation = config.mappingDevLocationRewrite(serveLocation);

    // If the route falls under the mapping record
    if (req.path.startsWith(serveLocation)) {
      const cleanServeLocation = req.path.replace(
        new RegExp(`^${_.escapeRegExp(serveLocation)}`, ''),
        ''
      );

      // Composing the file name
      const fileSrc = path.join(process.cwd(), staticPath, cleanServeLocation);

      const success = await config.fileDevProcessing({ fileSrc, req, res, next });
      if (success) {
        return;
      }
    }
  }

  next();
});

const server = (() => {
  if (config.http.https) {
    return https.createServer({ key: config.http.key, cert: config.http.cert }, app);
  }
  return app;
})();

server.listen(config.http.port, () => {
  console.info(`${config.http.https ? 'https' : 'http'}://localhost:${config.http.port}/`);
});
