const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const mime = require('mime-types');

const defaultFileDevProcessing = ({ fileSrc, res, modifyData = (data) => data }) => {
  // Reading the contents of the file
  let data;
  try {
    if (fs.pathExistsSync(fileSrc)) {
      data = fs.readFileSync(fileSrc, 'utf8');
    }
  } catch (e) {
    console.log('read error');
  }

  // If something is read, we return the content
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
  // Only if the file is not yet at the destination
  if (!fs.pathExistsSync(destinationFileSrc) && fs.pathExistsSync(fileSrc)) {
    let data = fs.readFileSync(fileSrc, 'utf8');

    data = modifyData(data, fileSrc);

    fs.ensureFileSync(destinationFileSrc);
    fs.writeFileSync(destinationFileSrc, data);
  }
};

// Default config
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
  mappingDevLocationRewrite: (dst) => dst,
  mappingBuildLocationRewrite: (dst) => dst,
  beforeBuild: () => {},
  afterBuild: () => {},
  beforeDevStart: () => {},
};

// Read user config
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

// Get all files in a folder
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
