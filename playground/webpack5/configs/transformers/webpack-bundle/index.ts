import path from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { makeTest, Transformer } from 'multi-static';
import webpack from 'webpack';
import { Volume, createFsFromVolume, IFs } from 'memfs';

type CompilerMode = 'development' | 'production';

type CompilerEntry = {
  compiler: webpack.Compiler;
  fs: IFs & { join?: typeof path.join };
  mode: CompilerMode;
  pending?: Promise<webpack.Stats>;
  lastAssets?: Map<string, Buffer>;
};

const staticRoot = path.resolve(process.cwd(), 'static');
const virtualOutDir = path.resolve(process.cwd(), '.multi-static-webpack');

const compilerCache = new Map<string, CompilerEntry>();
const registeredCompilers = new Set<webpack.Compiler>();
let shutdownHooksAttached = false;

const attachShutdownHooks = () => {
  if (shutdownHooksAttached) {
    return;
  }

  const disposeAll = () => {
    for (const compiler of Array.from(registeredCompilers)) {
      compiler.close(() => {
        // ignore
      });
    }
    registeredCompilers.clear();
  };

  process.once('SIGINT', disposeAll);
  process.once('SIGTERM', disposeAll);
  process.once('exit', disposeAll);

  shutdownHooksAttached = true;
};

const normalizeServePath = (servePath: string) => servePath.replace(/^[\\/]+/, '').replace(/\\/g, '/');
const ensureServeJsPath = (servePath: string) => normalizeServePath(servePath).replace(/\.ts$/, '.js');
const makeCacheKey = (entryPath: string, servePath: string, mode: CompilerMode) =>
  `${path.resolve(entryPath)}::${ensureServeJsPath(servePath)}::${mode}`;

const createMemoryFs = () => {
  const volume = new Volume();
  const fs = createFsFromVolume(volume) as IFs & { join?: typeof path.join };
  fs.join = path.join.bind(path);
  return fs;
};

const createWebpackConfig = (entryPath: string, servePath: string, mode: CompilerMode): webpack.Configuration => {
  const serveJsPath = ensureServeJsPath(servePath);
  const chunkDir = path.posix.dirname(serveJsPath);
  const chunkPrefix = chunkDir === '.' ? '' : `${chunkDir}/`;

  return {
    mode,
    context: staticRoot,
    entry: entryPath,
    target: ['web', 'es2020'],
    devtool: 'source-map',
    experiments: {
      outputModule: true,
    },
    output: {
      path: virtualOutDir,
      filename: serveJsPath,
      chunkFilename: `${chunkPrefix}[name]-[contenthash].js`,
      module: true,
      library: {
        type: 'module',
      },
      clean: false,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                compilerOptions: {
                  sourceMap: true,
                  declaration: false,
                },
              },
            },
          ],
        },
      ],
    },
    cache: mode === 'development' ? { type: 'memory' } : false,
    infrastructureLogging: {
      level: 'error',
    },
    stats: 'errors-warnings',
  };
};

const ensureCompiler = async (cacheKey: string, entryPath: string, servePath: string, mode: CompilerMode) => {
  let entry = compilerCache.get(cacheKey);

  if (!entry) {
    const config = createWebpackConfig(entryPath, servePath, mode);
    const compiler = webpack(config);
    const fs = createMemoryFs();

    if (!compiler || 'compilers' in compiler) {
      throw new Error('Конфигурация Webpack должна создавать одиночный compiler');
    }

    compiler.outputFileSystem = fs as unknown as typeof compiler.outputFileSystem;

    entry = { compiler, fs, mode };
    compilerCache.set(cacheKey, entry);
    registeredCompilers.add(compiler);
    attachShutdownHooks();
  }

  return entry;
};

const runCompiler = async (entry: CompilerEntry) => {
  if (!entry.pending) {
    entry.pending = new Promise<webpack.Stats>((resolve, reject) => {
      entry.compiler.run((error, stats) => {
        if (error) {
          entry.pending = undefined;
          reject(error);
          return;
        }

        if (!stats) {
          entry.pending = undefined;
          reject(new Error('Webpack compilation produced no stats'));
          return;
        }

        if (stats.hasErrors()) {
          const info = stats.toJson({ all: false, errors: true, warnings: true });
          const messages = info.errors?.map((item) => {
            if (!item) {
              return 'Unknown webpack error';
            }

            return item.message ?? 'Unknown webpack error';
          });

          entry.pending = undefined;
          reject(new Error(messages?.join('\n') || 'Webpack compilation failed'));
          return;
        }

        entry.pending = undefined;
        resolve(stats);
      });
    });
  }

  return entry.pending;
};

const readFsFile = (fs: IFs, filePath: string) =>
  new Promise<Buffer>((resolve, reject) => {
    fs.readFile(filePath, (error, data) => {
      if (error || !data) {
        reject(error ?? new Error(`Failed to read ${filePath}`));
        return;
      }

      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
  });

const collectAssets = async (entry: CompilerEntry, stats: webpack.Stats) => {
  const info = stats.toJson({ all: false, assets: true });
  const assetNames = info.assets?.map((asset) => asset.name).filter(Boolean) ?? [];
  const assets = new Map<string, Buffer>();

  await Promise.all(
    assetNames.map(async (assetName) => {
      const fullPath = path.join(entry.compiler.outputPath, assetName);
      const content = await readFsFile(entry.fs, fullPath);
      const normalizedName = normalizeServePath(assetName);
      assets.set(normalizedName, content);
    }),
  );

  return assets;
};

const compileAndCollect = async (entry: CompilerEntry) => {
  const stats = await runCompiler(entry);
  const assets = await collectAssets(entry, stats);

  if (assets.size > 0) {
    entry.lastAssets = assets;
    return { stats, assets };
  }

  if (entry.lastAssets) {
    return { stats, assets: entry.lastAssets };
  }

  entry.lastAssets = assets;
  return { stats, assets };
};

const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
};

const writeAssetsToDir = async (buildPath: string, assets: Map<string, Buffer>) => {
  await Promise.all(
    Array.from(assets.entries()).map(async ([name, content]) => {
      const destination = path.join(buildPath, name);
      await ensureDir(path.dirname(destination));
      await writeFile(destination, content);
    }),
  );
};

const disposeCompiler = async (cacheKey: string) => {
  const entry = compilerCache.get(cacheKey);
  if (!entry) {
    return;
  }

  compilerCache.delete(cacheKey);
  registeredCompilers.delete(entry.compiler);

  await new Promise<void>((resolve) => {
    entry.compiler.close(() => resolve());
  });
};

export const webpackBundleTransformer: Partial<Transformer> = {
  beforeTest: ({ file, mode }) => {
    const originalServeExt = path.extname(file.servePath);
    const originalSrcExt = path.extname(file.srcPath);

    if (mode === 'build' && ['.ts', '.js'].includes(originalSrcExt) && originalServeExt === '.ts') {
      file.servePath = file.servePath.replace(/\.ts$/, '.js');
    }

    if (originalSrcExt === '.js') {
      const tsCandidate = file.srcPath.replace(/\.js$/, '.ts');
      if (existsSync(tsCandidate)) {
        file.srcPath = tsCandidate;
      }
    }
  },
  test: makeTest({
    check: ({ file }) => ['.js', '.ts'].includes(path.extname(file.srcPath)),
    checkFirstLine: (firstLine) => firstLine.trim().startsWith('// @process'),
  }),
  sendResponse: async ({ file, res, next }) => {
    try {
      const mode: CompilerMode = 'development';
      const cacheKey = makeCacheKey(file.srcPath, file.servePath, mode);
      const entry = await ensureCompiler(cacheKey, file.srcPath, file.servePath, mode);
      const { assets } = await compileAndCollect(entry);
      const serveJsPath = ensureServeJsPath(file.servePath);
      const asset = assets.get(serveJsPath) ?? Array.from(assets.entries()).find(([name]) => name.endsWith('.js'))?.[1];

      if (!asset) {
        throw new Error(`Webpack output for ${serveJsPath} not found`);
      }

      res.setHeader('Content-Type', 'application/javascript');
      res.send(asset.toString('utf8'));
    } catch (error) {
      next(error as Error);
    }
  },
  writeContent: async ({ file, buildPath, mode }) => {
    const compilerMode: CompilerMode = mode === 'build' ? 'production' : 'development';
    const cacheKey = makeCacheKey(file.srcPath, file.servePath, compilerMode);
    const entry = await ensureCompiler(cacheKey, file.srcPath, file.servePath, compilerMode);
    const { assets } = await compileAndCollect(entry);

    await writeAssetsToDir(buildPath, assets);

    if (compilerMode === 'production') {
      await disposeCompiler(cacheKey);
    }
  },
};
