import path from 'path';
import mime from 'mime-types';
import glob from 'glob';
import noop from 'lodash/noop';
import merge from 'lodash/merge';
import escapeRegExp from 'lodash/escapeRegExp';
import fs from 'fs-extra';
import { BuildTransformer, DevTransformer, FileBuildProcessingParams, MultiStaticConfig } from './types';
import { transformSync as esbuildTransformSync } from 'esbuild';

export const defaultReader: DevTransformer['reader'] = ({ filePath }) => {
  return fs.readFileSync(filePath, 'utf-8');
};

export const defaultWriter: BuildTransformer['writer'] = ({ dstPath, content }) => {
  fs.ensureFileSync(dstPath);
  fs.writeFileSync(dstPath, content);
};

export const defaultDevTransformerMakeResponse: DevTransformer['makeResponse'] = ({ content, reqPath, res }) => {
  const mimeType = mime.lookup(reqPath);
  if (mimeType) {
    res.setHeader('Content-Type', mimeType);
  }

  res.send(content);
};

export const defaultDevTransformer: Partial<DevTransformer> = {
  reader: defaultReader,
  makeResponse: defaultDevTransformerMakeResponse,
};

export const defaultBuildTransformer: Partial<BuildTransformer> = {
  reader: defaultReader,
  makeResponse: defaultDevTransformerMakeResponse,
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
  devTransformers: [],
  // fileDevProcessing: defaultFileDevProcessing,
  // fileBuildProcessing: defaultFileBuildProcessing,
  mappingDevLocationRewrite: (dst) => dst,
  mappingBuildLocationRewrite: (dst) => dst,
  beforeBuild: noop,
  afterBuild: noop,
  beforeDevStart: noop,
  customOptions: {},
  optionsFileName: '_options.js',
};

export const defineConfig = (config: Partial<MultiStaticConfig>) => {
  return config;
};

export const extendedRequire = <T>(id: string): T => {
  const modulePath = require.resolve(id);
  const moduleContent = fs.readFileSync(modulePath, 'utf-8');
  const { code } = esbuildTransformSync(moduleContent, {
    format: 'cjs',
    platform: 'node',
    loader: 'ts',
    target: `node${process.versions.node}`,
    tsconfigRaw: '{"compilerOptions":{"useDefineForClassFields":true}}',
  });
  const module: { exports?: { default?: unknown } } = {
    exports: {},
  };
  // const context = { module, require };
  // vm.createContext(context);
  const wrappedSrc = `(function(module, exports, require) {${code}})(module, module.exports, require);`;
  // const script = new vm.Script(wrappedSrc, { filename: modulePath, displayErrors: false });
  try {
    // script.runInContext(context);
    eval(wrappedSrc);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  if (module.exports?.default) {
    return module.exports.default as T;
  }
  return module.exports as T;
};

// Read user config
export const readConfig = async (userConfigSrc: string | undefined) => {
  const configSrces = userConfigSrc
    ? [userConfigSrc]
    : ['multi-static.config.ts', 'multi-static.config.mjs', 'multi-static.config.cjs', 'multi-static.config.js'];

  for (const configSrc of configSrces) {
    const config: MultiStaticConfig = merge({}, defaultConfig);

    const configPath = path.join(process.cwd(), configSrc);

    try {
      await fs.ensureFile(configPath);
    } catch {
      continue;
    }

    const userConfig = extendedRequire<Partial<MultiStaticConfig>>(configPath) as MultiStaticConfig;
    console.log('+++', userConfig);
    merge(config, userConfig);

    return config;
  }

  throw new Error('Config not found');
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
