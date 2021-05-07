const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const mime = require('mime-types');

const defaultFileDevProcessing = ({ fileSrc, res, next }) => {
  console.log(fileSrc);

  // Читаем содержимое файла
  let data;
  try {
    if (fs.pathExistsSync(fileSrc)) {
      data = fs.readFileSync(fileSrc, 'utf8');
    }
  } catch (e) {
    console.log('read error');
  }

  // Если что-то прочиталось - отдаем содержимое
  if (data !== undefined) {
    // TODO тут обработать содержимое

    const mimeType = mime.lookup(fileSrc);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }

    return res.send(data);
  }
};

// Дефолтный конфиг
const defaultConfig = {
  http: {
    port: 3000,
    https: false,
    key: null,
    cert: null,
  },
  buildPath: path.join(process.cwd(), 'build'),
  mapping: [],
  fileDevProcessing: defaultFileDevProcessing,
  fileBuildProcessing: () => {},
};

// Прочитать пользователский конфиг
const readConfig = (userConfigSrc) => {
  const config = _.cloneDeep(defaultConfig);

  try {
    const userConfig = require(path.join(process.cwd(), userConfigSrc));
    _.merge(config, userConfig);
  } catch (e) {
    console.error('Wrong config');
    console.log(e);
    process.exit();
  }

  return config;
};

// Получить все файлы в папке
const getFilesList = (dir, pathList = []) => {
  fs.readdirSync(dir).forEach((file) => {
    const absolute = path.join(dir, file);
    if (fs.statSync(absolute).isDirectory()) {
      return getFilesList(absolute, pathList);
    } else return pathList.push(absolute);
  });

  return pathList;
};

const defaultFileBuildProcessing = ({ fileSrc, res }) => {};

module.exports = {
  defaultConfig,
  readConfig,
  getFilesList,
  defaultFileDevProcessing,
};
