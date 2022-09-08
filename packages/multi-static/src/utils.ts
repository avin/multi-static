import path from 'path';
import mime from 'mime-types';
import glob from 'glob';
import readFirstLine from 'read-first-line';
import noop from 'lodash/noop';
import merge from 'lodash/merge';
import escapeRegExp from 'lodash/escapeRegExp';
import fs from 'fs-extra';
import {
  Ctx,
  File,
  MaybePromise,
  MultiStaticConfig,
  NodeModuleWithCompile,
  SendResponseFunc,
  Transformer,
  TransformerMode,
  WriteContentFunc,
} from './types';
import { build as esbuildBuild } from 'esbuild';
import module from 'module';
import defu from 'defu';

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

export const defaultWriteContent: WriteContentFunc = async ({ file, content }) => {
  await fs.ensureFile(file.dstPath);
  await fs.writeFile(file.dstPath, content);
};

export const defaultSendResponse: SendResponseFunc = ({ content, file, res }) => {
  const mimeType = mime.lookup(file.dstPath);
  if (mimeType) {
    res.setHeader('Content-Type', mimeType);
  }
  res.send(content);
};

export const defaultStreamTransformer: Partial<Transformer> = {
  test: defaultTest,
  processors: [({ file }) => fs.createReadStream(file.srcPath)],
  sendResponse: ({ content, file, res }) => {
    const mimeType = mime.lookup(file.dstPath);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    content.pipe(res);
  },
  writeContent: async ({ file, content }) => {
    await fs.ensureFile(file.dstPath);
    const writeStream = fs.createWriteStream(file.dstPath);
    content.pipe(writeStream);
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

// Default config
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
  beforeBuild: noop,
  afterBuild: noop,
  beforeDevStart: noop,
  customOptions: {},
  optionsFileName: '_options.js',
};

export const defineConfig = (config: Partial<MultiStaticConfig>) => {
  return config;
};

export const executeModule = (fileName: string, bundledCode: string) => {
  const extension = path.extname(fileName);

  // @ts-expect-error
  const extensions = module.Module._extensions;
  let defaultLoader: any;
  const isJs = extension === '.js';
  if (isJs) {
    defaultLoader = extensions[extension]!;
  }

  extensions[extension] = (module: NodeModule, filename: string) => {
    if (filename === fileName) {
      (module as NodeModuleWithCompile)._compile(bundledCode, filename);
    } else {
      if (!isJs) {
        extensions[extension]!(module, filename);
      } else {
        defaultLoader(module, filename);
      }
    }
  };
  let config;
  try {
    if (isJs && require && require.cache) {
      delete require.cache[fileName];
    }
    const raw = require(fileName);
    config = raw.__esModule ? raw.default : raw;
    if (defaultLoader && isJs) {
      extensions[extension] = defaultLoader;
    }
  } catch (error) {
    console.error(error);
  }

  return config;
};

export const extendedRequire = async <T>(p: string): Promise<T> => {
  const pkg = require(path.join(process.cwd(), 'package.json'));

  const result = await esbuildBuild({
    entryPoints: [p],
    outfile: 'out.js',
    write: false,
    platform: 'node',
    bundle: true,
    format: 'cjs',
    metafile: true,
    target: 'es2015',
    external: ['esbuild', ...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
    logLevel: 'silent',
  });
  const { text } = result.outputFiles[0];

  return (await executeModule(p, text)) as T;
};

// export const extendedRequire = async <T>(filePath: string): Promise<T> => {
//   return (await resolveModule(filePath)) as T;
//   // // const moduleContent = fs.readFileSync(filePath, 'utf-8');
//   // // const { code } = esbuildTransformSync(moduleContent, {
//   // //   format: 'cjs',
//   // //   platform: 'node',
//   // //   loader: 'ts',
//   // //   target: `node${process.versions.node}`,
//   // //   tsconfigRaw: '{"compilerOptions":{"useDefineForClassFields":true}}',
//   // // });
//   //
//   //
//   //
//   // const result = esbuildBuildSync({
//   //   entryPoints: [filePath],
//   //   platform: 'node',
//   //   bundle: true,
//   //   write: false,
//   //   format: 'cjs',
//   //   metafile: true,
//   //   target: 'es2015',
//   //   external: ['esbuild', ...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
//   // });
//   //
//   // const code = result.outputFiles[0].text;
//   //
//   // const module: { exports?: { default?: unknown } } = {
//   //   exports: {},
//   // };
//   //
//   // // const context = { module, require };
//   // // vm.createContext(context);
//   // const wrappedSrc = `(function(module, exports, require) {${code}})(module, module.exports, require);`;
//   // // const script = new vm.Script(wrappedSrc, { filename: modulePath, displayErrors: false });
//   //
//   // try {
//   //   // script.runInContext(context);
//   //   eval(wrappedSrc);
//   //
//   //   // const obj = vm.runInNewContext(wrappedSrc);
//   //
//   //   console.log('++++++++', module);
//   // } catch (e) {
//   //   console.error(e);
//   //   process.exit(1);
//   // }
//   // if (module.exports?.default) {
//   //   return module.exports.default as T;
//   // }
//   // return module.exports as T;
// };

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

    const config: MultiStaticConfig = defu(userConfig, defaultConfig);

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
export const mixInCustomPageOptions = async ({
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
          const newPageOptions = await extendedRequire<Record<string, unknown>>(fileSrc);
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
