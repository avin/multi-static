#!/usr/bin/env node

const argv = require('yargs').argv;
const path = require('path');
const _ = require('lodash');
const fs = require('fs-extra');
const glob = require('glob');
const { getGlobBasePath } = require('./common');
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
    let staticFilesBasePath;

    const files = (() => {
      if (glob.hasMagic(staticFilesPath)) {
        // Путь без магической части
        staticFilesBasePath = path.join(process.cwd(), getGlobBasePath(staticPath));

        return glob.sync(staticFilesPath).map((i) => path.resolve(i));
      } else {
        if (fs.lstatSync(staticFilesPath).isDirectory()) {
          // Путь как он есть
          staticFilesBasePath = staticFilesPath;

          return getFilesList(staticFilesPath);
        } else {
          // Путь без самого имени файла
          staticFilesBasePath = path.join(process.cwd(), staticPath.replace(/\/[^\/]+$/, ''));

          return [staticFilesPath];
        }
      }
    })();

    for (const fileSrc of files) {
      const reqPath =
        serveLocation +
        fileSrc
          .replace(new RegExp(`^${_.escapeRegExp(staticFilesBasePath)}`, ''), '')
          .replace(new RegExp(_.escapeRegExp(path.sep), 'g'), '/');

      mixInCustomPageOptions({
        reqPath,
        config,
        originalCustomOptions,
        mode: 'build',
      });

      // ---------------------------

      const destinationFileSrc = fileSrc.replace(
        new RegExp(`^${_.escapeRegExp(staticFilesBasePath)}`),
        buildPath
      );

      await config.fileBuildProcessing({ fileSrc, destinationFileSrc });
    }
  }

  await config.afterBuild();
})();
