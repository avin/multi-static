/* eslint-disable */
import path from 'path';
import module from 'module';
import { build as esbuildBuild } from 'esbuild';

interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any;
}

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
