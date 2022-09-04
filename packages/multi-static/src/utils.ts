import path from 'path';
import mime from 'mime-types';
import glob from 'glob';
import noop from 'lodash/noop';
import merge from 'lodash/merge';
import escapeRegExp from 'lodash/escapeRegExp';
import fs from 'fs-extra';
import { FileBuildProcessingParams, FileDevProcessingParams, MultiStaticConfig } from './types';
import { transformSync as esbuildTransformSync } from 'esbuild';

export const defaultFileDevProcessing = ({ fileSrc, res }: FileDevProcessingParams): boolean => {
  // Reading the contents of the file
  let data: Buffer | undefined;
  try {
    if (fs.pathExistsSync(fileSrc)) {
      data = fs.readFileSync(fileSrc);
    }
  } catch (e) {
    console.warn('read error');
  }

  // If something is read, we return the content
  if (data !== undefined) {
    const mimeType = mime.lookup(fileSrc);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }

    res.send(data);
    return true;
  }
  return false;
};

export const defaultFileBuildProcessing = ({ fileSrc, destinationFileSrc }: FileBuildProcessingParams) => {
  // Only if the file is not yet at the destination
  if (!fs.pathExistsSync(destinationFileSrc) && fs.pathExistsSync(fileSrc)) {
    const data = fs.readFileSync(fileSrc);

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
  beforeBuild: noop,
  afterBuild: noop,
  beforeDevStart: noop,
  customOptions: {},
  optionsFileName: '_options.js',
};

export const extendedRequire = <T>(id: string): T => {
  const modulePath = require.resolve(id);
  const moduleContent = fs.readFileSync(modulePath, 'utf-8');
  const { code } = esbuildTransformSync(moduleContent, {
    format: 'cjs',
  });
  const module: { exports?: { default?: unknown } } = {
    exports: {},
  };
  const wrappedSrc = `(function(module, exports, require) {${code}})(module, module.exports, require);`;
  eval(wrappedSrc);
  if (module.exports?.default) {
    return module.exports.default as T;
  }
  return module.exports as T;
};

// Read user config
export const readConfig = (userConfigSrc: string) => {
  const config: MultiStaticConfig = merge({}, defaultConfig);

  try {
    const configPath = path.join(process.cwd(), userConfigSrc);

    const userConfig = extendedRequire<Partial<MultiStaticConfig>>(configPath) as MultiStaticConfig;
    merge(config, userConfig);
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

// Mix content of _options.js files to pageOptions of current config
export const mixInCustomPageOptions = ({
  reqPath,
  config,
  originalCustomOptions,
  mode,
  optionsFileName,
}: {
  reqPath: string;
  config: MultiStaticConfig;
  originalCustomOptions: Record<string, unknown>;
  mode: 'build' | 'dev';
  optionsFileName: string;
}) => {
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
        const cleanServeLocation = optionsPath.replace(new RegExp(`^${escapeRegExp(serveLocation)}`, ''), '');

        // Composing the file name
        const fileSrc = path.join(process.cwd(), staticPath, cleanServeLocation);

        try {
          const newPageOptions = extendedRequire<Record<string, unknown>>(fileSrc);
          newCustomOptions = merge({}, newPageOptions, newCustomOptions);
        } catch (e) {
          //
        }
      }
    }

    pathArr.pop();
  }
  config.customOptions = merge({}, originalCustomOptions, newCustomOptions);
};

export const getGlobBasePath = (globString: string, pathSep = '/') => {
  const globParts = globString.split(pathSep);

  let magicIndex = 0;
  for (let i = 0; i < globParts.length; i += 1) {
    if (glob.hasMagic(globParts[i])) {
      magicIndex = i;
      break;
    }
  }

  const result: string = globParts.splice(0, magicIndex).join('/');
  return result;
};
