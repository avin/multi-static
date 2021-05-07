const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const mime = require('mime-types');

const defaultFileDevProcessing = ({ fileSrc, res, modifyData = (data) => data }) => {
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
    data = modifyData(data, fileSrc);

    const mimeType = mime.lookup(fileSrc);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }

    return res.send(data);
  }
};

const defaultFileBuildProcessing = ({
  fileSrc,
  destinationFileSrc,
  modifyData = (data) => data,
}) => {
  // Только если файла еще нет в месте назначения
  if (!fs.pathExistsSync(destinationFileSrc) && fs.pathExistsSync(fileSrc)) {
    let data = fs.readFileSync(fileSrc, 'utf8');

    data = modifyData(data, fileSrc);

    fs.ensureFileSync(destinationFileSrc);
    fs.writeFileSync(destinationFileSrc, data);
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
  fileBuildProcessing: defaultFileBuildProcessing,
};

// Прочитать пользователский конфиг
const readConfig = (userConfigSrc) => {
  const config = _.cloneDeep(defaultConfig);

  try {
    const userConfig = require(path.join(process.cwd(), userConfigSrc));
    _.merge(config, userConfig);
  } catch (e) {
    console.error('Wrong config');
    console.error(e);
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

module.exports = {
  defaultConfig,
  readConfig,
  getFilesList,
  defaultFileDevProcessing,
  defaultFileBuildProcessing,
};
