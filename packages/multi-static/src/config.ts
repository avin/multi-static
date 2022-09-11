// Default config
import {
  Ctx,
  File,
  MaybePromise,
  MultiStaticConfig,
  SendResponseFunc,
  Transformer,
  TransformerMode,
  WriteContentFunc,
} from './types';
import path from 'path';
import fs from 'fs-extra';
import { extendedRequire } from './utils/module';
import defu from 'defu';
import merge from 'lodash/merge';
import readFirstLine from 'read-first-line';
import mime from 'mime-types';
import { Stream } from 'stream';
import { escapeRegExp, relativePath, reverse } from './utils/helpers';

export const makeTest = ({
  check,
  checkFirstLine,
  checkFileExists = true,
}: {
  check?: (params: { file: File; ctx: Ctx; mode: TransformerMode }) => MaybePromise<boolean>;
  checkFirstLine?: (firstLine: string) => MaybePromise<boolean>;
  checkFileExists?: boolean;
} = {}) => {
  return async ({ file, mode, ctx }: { file: File; mode: TransformerMode; ctx: Ctx }): Promise<boolean> => {
    if (checkFileExists) {
      if (!(fs.existsSync(file.srcPath) && fs.lstatSync(file.srcPath).isFile())) {
        return false;
      }
    }
    if (check) {
      if (!(await check({ file, mode, ctx }))) {
        return false;
      }
    }
    if (checkFirstLine) {
      const firstLine = await readFirstLine(file.srcPath);
      if (!(await checkFirstLine(firstLine))) {
        return false;
      }
    }
    return true;
  };
};

export const defaultTest = makeTest();

export const defaultFileReader = ({ file }: { file: File }) => {
  return fs.readFileSync(file.srcPath, 'utf-8');
};

export const defaultWriteContent: WriteContentFunc = async ({ file, content, buildPath }) => {
  const dstPath = path.join(buildPath, file.servePath);
  await fs.ensureFile(dstPath);
  await fs.writeFile(dstPath, content);
};

export const defaultSendResponse: SendResponseFunc = ({ content, file, res }) => {
  const mimeType = mime.lookup(file.servePath);
  if (mimeType) {
    res.setHeader('Content-Type', mimeType);
  }
  res.send(content);
};

export const defaultStreamTransformer: Partial<Transformer> = {
  test: defaultTest,
  processors: [({ file }) => fs.createReadStream(file.srcPath)],
  sendResponse: ({ content, file, res }) => {
    const mimeType = mime.lookup(file.servePath);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    (content as Stream).pipe(res);
  },
  writeContent: async ({ file, content, buildPath }) => {
    const dstPath = path.join(buildPath, file.servePath);
    await fs.ensureFile(dstPath);
    const writeStream = fs.createWriteStream(dstPath);
    (content as Stream).pipe(writeStream);
  },
};

export const defaultTransformer: Partial<Transformer> = {
  test: defaultTest,
  processors: [
    ({ file }) => {
      return fs.readFileSync(file.srcPath);
    },
  ],
  sendResponse: defaultSendResponse,
  writeContent: defaultWriteContent,
};

export const defaultConfig: MultiStaticConfig = {
  http: {
    port: 3000,
    key: undefined,
    cert: undefined,
  },
  buildPath: path.join(process.cwd(), 'build'),
  mapping: [],
  transformers: [],
  mappingDevLocationRewrite: (dst) => dst,
  mappingBuildLocationRewrite: (dst) => dst,
  customOptions: {},
  customOptionsFileName: '_options.js',
};

export const defineConfig = (config: Partial<MultiStaticConfig>) => {
  return config;
};

// Read user config
export const readConfig = async (userConfigSrc: string | undefined) => {
  const configSrces = userConfigSrc
    ? [userConfigSrc]
    : ['multi-static.config.ts', 'multi-static.config.mjs', 'multi-static.config.cjs', 'multi-static.config.js'];

  for (const configSrc of configSrces) {
    const configPath = path.join(process.cwd(), configSrc);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    const userConfig = await extendedRequire<Partial<MultiStaticConfig>>(configPath);

    return defu(userConfig, defaultConfig) as MultiStaticConfig;
  }

  throw new Error('Multi-static config not found');
};

// Mix content of _options.js files to pageOptions of current config
export const mixInCustomPageOptions = async ({
  servePath,
  config,
  originalCustomOptions,
  mode,
  customOptionsFileName,
}: {
  servePath: string;
  config: MultiStaticConfig;
  originalCustomOptions: Record<string, unknown>;
  mode: 'build' | 'dev';
  customOptionsFileName: string;
}) => {
  let newCustomOptions = {};

  const pathArr = servePath.split('/').slice(0, -1);
  while (pathArr.length) {
    const customOptionsPath = pathArr.join('/') + '/' + customOptionsFileName;

    for (let [srcLocation, serveLocation] of config.mapping) {
      srcLocation = path.join(process.cwd(), srcLocation);

      if (mode === 'build') {
        serveLocation = config.mappingBuildLocationRewrite(serveLocation);
      } else if (mode === 'dev') {
        serveLocation = config.mappingDevLocationRewrite(serveLocation);
      }

      if (customOptionsPath.startsWith(serveLocation)) {
        const customOptionsSubPath = relativePath(customOptionsPath, serveLocation);

        const filePath = path.join(srcLocation, customOptionsSubPath);

        try {
          const newPageOptions = await extendedRequire<Record<string, unknown>>(filePath);
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
