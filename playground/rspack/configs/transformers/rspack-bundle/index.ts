import path from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile, stat } from 'fs/promises';
import { makeTest, Transformer } from 'multi-static';
import { rspack, type Compiler, type Configuration, type Stats } from '@rspack/core';
import { Volume, createFsFromVolume, type IFs } from 'memfs';

type CompilerMode = 'development' | 'production';

type CompilerEntry = {
  compiler: Compiler;
  fs: IFs & { join?: typeof path.join };
  mode: CompilerMode;
  pending?: Promise<Stats>;
  lastAssets?: Map<string, Buffer>;
  deps?: Map<string, number>;
};

const staticRoot = path.resolve(process.cwd(), 'static');
const virtualOutDir = path.resolve(process.cwd(), '.multi-static-rspack');

const compilerCache = new Map<string, CompilerEntry>();
const registeredCompilers = new Set<Compiler>();
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

const createRspackConfig = (
  entryPath: string,
  servePath: string,
  mode: CompilerMode,
  build: boolean,
): Configuration => {
  const serveJsPath = ensureServeJsPath(servePath);
  const chunkDir = path.posix.dirname(serveJsPath);
  const chunkPrefix = chunkDir === '.' ? '' : `${chunkDir}/`;
  const isProd = mode === 'production';

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
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                  },
                  target: 'es2020',
                },
                sourceMap: true,
              },
            },
          ],
        },
      ],
    },
    optimization: {
      minimize: isProd,
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
    },
    cache: false,
    infrastructureLogging: {
      level: 'error',
    },
    stats: 'errors-warnings',
  };
};

const ensureCompiler = async (
  cacheKey: string,
  entryPath: string,
  servePath: string,
  mode: CompilerMode,
  build: boolean,
) => {
  let entry = compilerCache.get(cacheKey);

  if (!entry) {
    const config = createRspackConfig(entryPath, servePath, mode, build);
    const compiler = rspack(config);
    const fs = createMemoryFs();

    if (!compiler || 'compilers' in (compiler as unknown as { compilers?: unknown })) {
      throw new Error('Конфигурация Rspack должна создавать одиночный compiler');
    }

    compiler.outputFileSystem = fs as unknown as Compiler['outputFileSystem'];

    entry = { compiler, fs, mode };
    compilerCache.set(cacheKey, entry);
    registeredCompilers.add(compiler);
    attachShutdownHooks();
  }

  return entry;
};

const runCompiler = async (entry: CompilerEntry) => {
  if (!entry.pending) {
    entry.pending = new Promise<Stats>((resolve, reject) => {
      entry.compiler.run((error, stats) => {
        if (error) {
          entry.pending = undefined;
          reject(error);
          return;
        }

        if (!stats) {
          entry.pending = undefined;
          reject(new Error('Rspack compilation produced no stats'));
          return;
        }

        if (stats.hasErrors()) {
          const info = stats.toJson({ all: false, errors: true, warnings: true });
          const messages = info.errors?.map((item) => {
            if (!item) {
              return 'Unknown Rspack error';
            }

            if (typeof item === 'string') {
              return item;
            }

            return item.message ?? 'Unknown Rspack error';
          });

          entry.pending = undefined;
          reject(new Error(messages?.join('\n') || 'Rspack compilation failed'));
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

const collectAssets = async (entry: CompilerEntry, stats: Stats) => {
  const info = stats.toJson({ all: false, assets: true });
  const assetNames = info.assets?.map((asset) => asset?.name).filter(Boolean) ?? [];
  const assets = new Map<string, Buffer>();

  await Promise.all(
    assetNames.map(async (assetName) => {
      const normalizedName = normalizeServePath(assetName as string);
      const fullPath = path.join(entry.compiler.outputPath, normalizedName);
      const content = await readFsFile(entry.fs, fullPath);
      assets.set(normalizedName, content);
    }),
  );

  return assets;
};

const collectDependencies = async (stats: Stats) => {
  const compilation = (stats as unknown as { compilation?: { fileDependencies?: Iterable<string> } }).compilation;
  const files = Array.from(compilation?.fileDependencies ?? []);
  const deps = new Map<string, number>();

  await Promise.all(
    files.map(async (filePath) => {
      try {
        const fileStats = await stat(filePath);
        deps.set(filePath, fileStats.mtimeMs);
      } catch {
        // файл могли удалить или он недоступен — игнорируем, пересоберём при следующем запросе
      }
    }),
  );

  return deps;
};

const dependenciesChanged = async (entry: CompilerEntry) => {
  if (!entry.deps) {
    return true;
  }

  for (const [filePath, mtime] of entry.deps.entries()) {
    try {
      const current = await stat(filePath);
      if (current.mtimeMs !== mtime) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
};

const ensureAssets = async (entry: CompilerEntry, force = false) => {
  const shouldRebuild = force || !entry.lastAssets || !entry.deps || (await dependenciesChanged(entry));

  if (shouldRebuild) {
    const stats = await runCompiler(entry);
    const assets = await collectAssets(entry, stats);
    const deps = await collectDependencies(stats);

    if (assets.size > 0) {
      entry.lastAssets = assets;
    } else if (!entry.lastAssets) {
      entry.lastAssets = assets;
    }

    entry.deps = deps;
  }

  return entry.lastAssets ?? new Map<string, Buffer>();
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

export const rspackBundleTransformer: Partial<Transformer> = {
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
      const entry = await ensureCompiler(cacheKey, file.srcPath, file.servePath, mode, false);
      const assets = await ensureAssets(entry);
      const serveJsPath = ensureServeJsPath(file.servePath);
      const asset = assets.get(serveJsPath) ?? Array.from(assets.entries()).find(([name]) => name.endsWith('.js'))?.[1];

      if (!asset) {
        throw new Error(`Rspack output for ${serveJsPath} not found`);
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
    const entry = await ensureCompiler(cacheKey, file.srcPath, file.servePath, compilerMode, mode === 'build');
    const assets = await ensureAssets(entry, mode === 'build');

    await writeAssetsToDir(buildPath, assets);

    if (compilerMode === 'production') {
      await disposeCompiler(cacheKey);
    }
  },
};
