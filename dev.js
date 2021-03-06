#!/usr/bin/env node

const argv = require('yargs').argv;
const path = require('path');
const https = require('https');
const _ = require('lodash');
const fs = require('fs-extra');
const express = require('express');
const glob = require('glob');
const { getGlobBasePath } = require('./common');
const { readConfig, mixInCustomPageOptions } = require('./common');

// Loading user configuration
const config = readConfig(argv.config);
const originalCustomOptions = config.customOptions;

const app = express();

config.beforeDevStart(app);

// Хедеры пресекающие работу кеша в браузере
app.use((_req, res, next) => {
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
});

app.use(async function (req, res, next) {
  mixInCustomPageOptions({
    reqPath: req.path,
    config,
    originalCustomOptions,
    mode: 'dev',
    optionsFileName: config.optionsFileName
  });

  // ---------------------------

  for (let [staticPath, serveLocation] of config.mapping) {
    serveLocation = config.mappingDevLocationRewrite(serveLocation);

    // Если роут попадает под условие serveLocation
    if (req.path.startsWith(serveLocation)) {
      const cleanServeLocation = req.path.replace(
        new RegExp(`^${_.escapeRegExp(serveLocation)}`, ''),
        ''
      );

      let fileSrc;

      if (glob.hasMagic(staticPath)) {
        // Если glob
        const filePaths = glob.sync(staticPath);

        filePaths.forEach((filePath) => {
          // Часть пути до файла в основе которой магия glob
          const globFilePart = filePath.replace(
            new RegExp(`^${_.escapeRegExp(getGlobBasePath(staticPath))}`),
            ''
          );

          if (globFilePart === cleanServeLocation) {
            fileSrc = path.join(process.cwd(), filePath);
          }
        });
      } else {
        const baseFileSrc = path.join(process.cwd(), staticPath);

        if (
          fs.existsSync(baseFileSrc) &&
          !fs.lstatSync(baseFileSrc).isDirectory() &&
          staticPath.endsWith(cleanServeLocation)
        ) {
          // Если соло-файл
          fileSrc = baseFileSrc;
        } else {
          // Если папка
          fileSrc = path.join(process.cwd(), staticPath, cleanServeLocation);
        }
      }

      if (fileSrc) {
        const success = await config.fileDevProcessing({ fileSrc, req, res, next });
        if (success) {
          return;
        }
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
