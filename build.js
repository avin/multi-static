#!/usr/bin/env node

const argv = require('yargs').argv;
const path = require('path');
const _ = require('lodash');
const fs = require('fs-extra');
const { readConfig, getFilesList, mixInCustomPageOptions } = require('./common');

(async () => {
  // Loading user configuration
  const config = readConfig(argv.config);
  const originalCustomOptions = config.customOptions;

  await config.beforeBuild();

  // Copy files according to the list from config.mapping
  for (let [staticPath, serveLocation] of config.mapping) {
    serveLocation = config.mappingBuildLocationRewrite(serveLocation);

    const buildPath = path.join(config.buildPath, serveLocation);

    const staticFilesPath = path.join(process.cwd(), staticPath);

    const files = (() => {
      if (fs.lstatSync(staticFilesPath).isDirectory()) {
        return getFilesList(staticFilesPath);
      } else {
        return [staticFilesPath];
      }
    })();

    for (const fileSrc of files) {
      const reqPath =
        serveLocation +
        fileSrc
          .replace(new RegExp(`^${_.escapeRegExp(staticFilesPath)}`, ''), '')
          .replace(new RegExp(_.escapeRegExp(path.sep), 'g'), '/');

      mixInCustomPageOptions({
        reqPath,
        config,
        originalCustomOptions,
      });

      // ---------------------------

      const destinationFileSrc = fileSrc.replace(
        new RegExp(`^${_.escapeRegExp(staticFilesPath)}`),
        buildPath
      );

      await config.fileBuildProcessing({ fileSrc, destinationFileSrc });
    }
  }

  await config.afterBuild();
})();
