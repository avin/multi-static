#!/usr/bin/env node

const argv = require('yargs').argv;
const path = require('path');
const _ = require('lodash');
const fs = require('fs-extra');
const { readConfig, getFilesList } = require('./common');

(async () => {
  // Грузим конфигурацию пользователя
  const config = readConfig(argv.config);

  fs.removeSync(config.buildPath);

  await config.preBuild();

  // Будем копировать файлы по списку из config.mapping
  for (const [staticPath, serveLocation] of config.mapping) {
    const buildPath = path.join(config.buildPath, serveLocation);

    const staticFilesPath = path.join(process.cwd(), staticPath);

    const files = getFilesList(staticFilesPath);

    for (const fileSrc of files) {
      const destinationFileSrc = fileSrc.replace(
        new RegExp(`^${_.escapeRegExp(staticFilesPath)}`),
        buildPath
      );

      await config.fileBuildProcessing({ fileSrc, destinationFileSrc });
    }
  }

  await config.postBuild();
})();
