import path from 'path';
import mime from 'mime-types';
import glob from 'glob';
import _ from 'lodash';
import fs from 'fs-extra';
import { MultiStaticConfig } from './types';
import { Response } from 'express';

export const defaultFileDevProcessing = ({
  fileSrc,
  res,
  modifyData = (data, fileSrc) => data,
}: {
  fileSrc: string;
  res: Response;
  modifyData: (data: any, fileSrc: string) => any;
}): boolean => {
  // Reading the contents of the file
  let data: any;
  try {
    if (fs.pathExistsSync(fileSrc)) {
      data = fs.readFileSync(fileSrc);
    }
  } catch (e) {
    console.warn('read error');
  }

  // If something is read, we return the content
  if (data !== undefined) {
    data = modifyData(data, fileSrc);

    const mimeType = mime.lookup(fileSrc);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }

    res.send(data);
    return true;
  }
  return false;
};

export const defaultFileBuildProcessing = ({
  fileSrc,
  destinationFileSrc,
  modifyData = (data, fileSrc) => data,
}: {
  fileSrc: string;
  destinationFileSrc: string;
  modifyData: (data: any, fileSrc: string) => any;
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
export const defaultConfig: MultiStaticConfig = {
  http: {
    port: 3000,
    key: undefined,
    cert: undefined,
  },
  buildPath: path.join(process.cwd(), 'build'),
  mapping: [],
  fileDevProcessing: defaultFileDevProcessing,
  fileBuildProcessing: defaultFileBuildProcessing,
  mappingDevLocationRewrite: (dst) => dst,
  mappingBuildLocationRewrite: (dst) => dst,
  beforeBuild: _.noop,
  afterBuild: _.noop,
  beforeDevStart: _.noop,
  customOptions: {},
  optionsFileName: '_options.js',
};

// Read user config
export const readConfig = (userConfigSrc: string) => {
  const config = _.cloneDeep(defaultConfig);

  try {
    const userConfig = require(path.join(process.cwd(), userConfigSrc)) as MultiStaticConfig;
    _.merge(config, userConfig);
  } catch (e) {
    console.error('Wrong config');
    console.error(e);
    process.exit();
  }

  return config;
};

// Get all files in a folder
export const getFilesList = (dir: string, pathList: string[] = []) => {
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

export const requireUncached = (module: string) => {
  delete require.cache[require.resolve(module)];
  return require(module);
};

// Mix content of _options.js files to pageOptions of current config
export const mixInCustomPageOptions = ({ reqPath, config, originalCustomOptions, mode, optionsFileName }) => {
  let newCustomOptions = {};

  const pathArr = reqPath.split('/').slice(0, -1);
  while (pathArr.length) {
    const optionsPath = pathArr.join('/') + '/' + optionsFileName;

    for (let [staticPath, serveLocation] of config.mapping) {
      if (mode === 'build') {
        serveLocation = config.mappingBuildLocationRewrite(serveLocation);
      } else if (mode === 'dev') {
        serveLocation = config.mappingDevLocationRewrite(serveLocation);
      }

      // If the route falls under the mapping record
      if (optionsPath.startsWith(serveLocation)) {
        const cleanServeLocation = optionsPath.replace(new RegExp(`^${_.escapeRegExp(serveLocation)}`, ''), '');

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

export const getGlobBasePath = (globString: string, pathSep = '/') => {
  const globParts = globString.split(pathSep);

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
