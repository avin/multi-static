import * as path from 'path';
import * as crypto from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { makeTest, Transformer } from 'multi-static';
import { rollup as rollupBuild, watch as rollupWatch } from 'rollup';
import type { OutputChunk, RollupBuild, RollupOutput, RollupWatcher, RollupWatchOptions } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const staticRoot = path.resolve(process.cwd(), 'static');
const devOutRoot = path.join(process.cwd(), '.multi-static-rollup-dev');

const normalizeServeFileName = (servePath: string) =>
  servePath
    .replace(/^[\\/]+/, '')
    .split(path.sep)
    .join(path.posix.sep);

const makeCacheKey = (entryPath: string, servePath: string) => `${path.resolve(entryPath)}::${servePath}`;
const hashCacheKey = (cacheKey: string) => crypto.createHash('md5').update(cacheKey).digest('hex');

const getOutputPatterns = (normalizedServePath: string) => {
  const dir = path.posix.dirname(normalizedServePath);
  const prefix = dir === '.' ? '' : `${dir}/`;

  return {
    entryFileNames: normalizedServePath,
    chunkFileNames: `${prefix}[name]-[hash].js`,
    assetFileNames: `${prefix}[name][extname]`,
  };
};

const createInputOptions = (entryPath: string, normalizedServePath: string) => {
  return {
    input: entryPath,
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false,
        extensions: ['.mjs', '.js', '.json', '.ts', '.tsx'],
      }),
      commonjs(),
      typescript({
        tsconfig: false,
        compilerOptions: {
          sourceMap: true,
          declaration: false,
        },
      }),
    ],
    treeshake: false,
    onwarn(warning, warn) {
      if (warning.code === 'THIS_IS_UNDEFINED') {
        return;
      }
      warn(warning);
    },
  };
};

const createOutputOptions = (normalizedServePath: string) => ({
  format: 'es' as const,
  sourcemap: true,
  dir: '.',
  ...getOutputPatterns(normalizedServePath),
});

type WatcherEntry = {
  watcher: RollupWatcher;
  outDir: string;
  normalizedServePath: string;
  currentBuild: Promise<void> | null;
  resolve?: () => void;
  reject?: (error: Error) => void;
};

const devWatchers = new Map<string, WatcherEntry>();
const registeredWatchers = new Set<RollupWatcher>();
let shutdownHooksAttached = false;

const attachShutdownHooks = () => {
  if (shutdownHooksAttached) {
    return;
  }

  const disposeAll = () => {
    registeredWatchers.forEach((watcher) => {
      try {
        watcher.close();
      } catch (error) {
        // ignore
      }
    });
  };

  process.once('SIGINT', disposeAll);
  process.once('SIGTERM', disposeAll);
  process.once('exit', disposeAll);

  shutdownHooksAttached = true;
};

const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
};

const ensureDevWatcher = async (cacheKey: string, entryPath: string, servePath: string): Promise<WatcherEntry> => {
  const normalizedServePath = normalizeServeFileName(servePath);
  let watcherEntry = devWatchers.get(cacheKey);

  if (!watcherEntry) {
    const outDir = path.join(devOutRoot, hashCacheKey(cacheKey));
    await ensureDir(outDir);

    const inputOptions = createInputOptions(entryPath, normalizedServePath);

    const outputPatterns = getOutputPatterns(normalizedServePath);
    const watchOptions: RollupWatchOptions = {
      ...inputOptions,
      watch: {
        buildDelay: 0,
        clearScreen: false,
      },
      output: [
        {
          format: 'es',
          sourcemap: true,
          dir: outDir,
          ...outputPatterns,
        },
      ],
    };

    const watcher = rollupWatch(watchOptions);

    watcherEntry = {
      watcher,
      outDir,
      normalizedServePath,
      currentBuild: null,
    };

    const setPending = () => {
      watcherEntry!.currentBuild = new Promise<void>((resolve, reject) => {
        watcherEntry!.resolve = resolve;
        watcherEntry!.reject = reject;
      });
    };

    setPending();

    watcher.on('event', (event) => {
      switch (event.code) {
        case 'BUNDLE_START': {
          if (!watcherEntry!.currentBuild) {
            setPending();
          }
          break;
        }
        case 'BUNDLE_END': {
          if (event.result) {
            event.result.close().catch(() => {
              // ignore
            });
          }
          watcherEntry!.resolve?.();
          watcherEntry!.resolve = undefined;
          watcherEntry!.reject = undefined;
          watcherEntry!.currentBuild = null;
          break;
        }
        case 'ERROR': {
          const error = event.error instanceof Error ? event.error : new Error(event.error?.message || 'Rollup error');
          watcherEntry!.reject?.(error);
          watcherEntry!.resolve = undefined;
          watcherEntry!.reject = undefined;
          watcherEntry!.currentBuild = null;
          break;
        }
        default:
          break;
      }
    });

    devWatchers.set(cacheKey, watcherEntry);
    registeredWatchers.add(watcher);
    attachShutdownHooks();
  }

  if (watcherEntry.currentBuild) {
    await watcherEntry.currentBuild;
  }

  return watcherEntry;
};

const bundleOnce = async (entryPath: string, servePath: string) => {
  const normalizedServePath = normalizeServeFileName(servePath);
  const inputOptions = createInputOptions(entryPath, normalizedServePath);
  const bundle: RollupBuild = await rollupBuild(inputOptions);

  try {
    const outputOptions = createOutputOptions(normalizedServePath);
    const output = await bundle.generate(outputOptions);
    return output;
  } finally {
    await bundle.close();
  }
};

const writeRollupOutput = async (buildPath: string, output: RollupOutput) => {
  for (const item of output.output) {
    const destination = path.join(buildPath, item.fileName);
    await ensureDir(path.dirname(destination));

    if (item.type === 'asset') {
      if (typeof item.source === 'string') {
        await writeFile(destination, item.source, 'utf8');
      } else {
        await writeFile(destination, Buffer.from(item.source));
      }
    } else {
      await writeFile(destination, item.code, 'utf8');
    }
  }
};

const findEntryChunk = (servePath: string, output: RollupOutput) => {
  const normalizedServePath = normalizeServeFileName(servePath);
  for (const item of output.output) {
    if (item.type === 'chunk' && item.fileName === normalizedServePath) {
      return item;
    }
  }
  return undefined;
};

export const rollupBundleTransformer: Partial<Transformer> = {
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
  sendResponse: async ({ file, res, next, mode }) => {
    if (mode === 'dev') {
      try {
        const cacheKey = makeCacheKey(file.srcPath, file.servePath);
        const watcherEntry = await ensureDevWatcher(cacheKey, file.srcPath, file.servePath);
        const outputPath = path.join(watcherEntry.outDir, watcherEntry.normalizedServePath);
        const code = await readFile(outputPath, 'utf8');

        res.setHeader('Content-Type', 'application/javascript');
        res.send(code);
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    try {
      const output = await bundleOnce(file.srcPath, file.servePath);
      const chunk = findEntryChunk(file.servePath, output);
      if (!chunk) {
        throw new Error(`Rollup output for ${file.servePath} not found`);
      }

      res.setHeader('Content-Type', 'application/javascript');
      res.send(chunk.code);
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  },
  writeContent: async ({ file, buildPath }) => {
    const output = await bundleOnce(file.srcPath, file.servePath);
    await writeRollupOutput(buildPath, output);
  },
};
