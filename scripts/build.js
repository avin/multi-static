const argv = require('yargs').argv;
const path = require('path');
const _ = require('lodash');
const fs = require('fs-extra');
const { readConfig, getFilesList } = require('./common');

// Грузим конфигурацию пользователя
const config = readConfig(argv.config);

fs.removeSync(config.buildPath);

// Будем копировать файлы по списку из config.mapping
for (const [staticPath, serveLocation] of config.mapping) {
  const buildPath = path.join(config.buildPath, serveLocation);

  const staticFilesPath = path.join(process.cwd(), staticPath);

  const files = getFilesList(staticFilesPath);

  for (const file of files) {
    const destinationFile = file.replace(
      new RegExp(`^${_.escapeRegExp(staticFilesPath)}`),
      buildPath
    );

    // Только если файла еще нет в месте назначения
    if (!fs.ensureFileSync(destinationFile)) {
      const data = fs.readFileSync(file, 'utf8');

      // TODO тут обработать содержимое

      fs.writeFileSync(destinationFile, data);
    }
  }
}
