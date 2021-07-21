const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const glob = require('glob');
const mime = require('mime-types');

const defaultFileDevProcessing = ({ fileSrc, res, modifyData = (data) => data }) => {
  // Reading the contents of the file
  let data;
  try {
    if (fs.pathExistsSync(fileSrc)) {
      data = fs.readFileSync(fileSrc);
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
    let data = fs.readFileSync(fileSrc);

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
  beforeBuild() {},
  afterBuild: () => {},
  beforeDevStart: () => {},
  customOptions: {},
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
  if (fs.pathExistsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const absolute = path.join(dir, file);
      if (fs.statSync(absolute).isDirectory()) {
        return getFilesList(absolute, pathList);
      } else return pathList.push(absolute);
    });
  }

  return pathList;
};

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

// Mix content of _options.js files to pageOptions of current config
const mixInCustomPageOptions = ({ reqPath, config, originalCustomOptions, mode }) => {
  let newCustomOptions = {};

  const pathArr = reqPath.split('/').slice(0, -1);
  while (pathArr.length) {
    const optionsPath = pathArr.join('/') + '/' + '_options.js';

    for (let [staticPath, serveLocation] of config.mapping) {
      if (mode === 'build') {
        serveLocation = config.mappingBuildLocationRewrite(serveLocation);
      } else if (mode === 'dev') {
        serveLocation = config.mappingDevLocationRewrite(serveLocation);
      }

      // If the route falls under the mapping record
      if (optionsPath.startsWith(serveLocation)) {
        const cleanServeLocation = optionsPath.replace(
          new RegExp(`^${_.escapeRegExp(serveLocation)}`, ''),
          ''
        );

        // Composing the file name
        const fileSrc = path.join(process.cwd(), staticPath, cleanServeLocation);

        try {
          const newPageOptions = requireUncached(fileSrc);
          newCustomOptions = _.merge({}, newPageOptions, newCustomOptions);
        } catch {}
      }
    }

    pathArr.pop();
  }
  config.customOptions = _.merge({}, originalCustomOptions, newCustomOptions);
};

const getGlobBasePath = (globString, pathSep = '/') => {
  let globParts = globString.split(pathSep);

  let magicIndex;
  for (let i = 0; i < globParts.length; i += 1) {
    if (glob.hasMagic(globParts[i])) {
      magicIndex = i;
      break;
    }
  }

  const result = globParts.splice(0, magicIndex).join('/');
  return result;
};

module.exports = {
  defaultConfig,
  readConfig,
  getFilesList,
  defaultFileDevProcessing,
  defaultFileBuildProcessing,
  mixInCustomPageOptions,
  getGlobBasePath,
};
