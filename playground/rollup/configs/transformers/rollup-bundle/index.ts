import * as path from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile, stat } from 'fs/promises';
import { makeTest, Transformer } from 'multi-static';
import { rollup as rollupBuild } from 'rollup';
import type { RollupBuild, RollupCache, RollupOutput } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const staticRoot = path.resolve(process.cwd(), 'static');

const normalizeServeFileName = (servePath: string) =>
  servePath
    .replace(/^[\\/]+/, '')
    .split(path.sep)
    .join(path.posix.sep);

const makeCacheKey = (entryPath: string, servePath: string) => `${path.resolve(entryPath)}::${servePath}`;

const getOutputPatterns = (normalizedServePath: string) => {
  const dir = path.posix.dirname(normalizedServePath);
  const prefix = dir === '.' ? '' : `${dir}/`;

  return {
    entryFileNames: normalizedServePath,
    chunkFileNames: `${prefix}[name]-[hash].js`,
    assetFileNames: `${prefix}[name][extname]`,
  };
};

const createInputOptions = (entryPath: string) => {
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
  ...getOutputPatterns(normalizedServePath),
});

type MemoryEntry = {
  cache?: RollupCache;
  output?: RollupOutput;
  deps?: Map<string, number>;
  pending?: Promise<RollupOutput>;
};

const memoryCache = new Map<string, MemoryEntry>();

const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
};

const collectDependencies = async (bundle: RollupBuild) => {
  const deps = new Map<string, number>();

  await Promise.all(
    bundle.watchFiles.map(async (file) => {
      try {
        const fileStats = await stat(file);
        deps.set(file, fileStats.mtimeMs);
      } catch {
        // файл могли удалить — просто пропускаем
      }
    }),
  );

  return deps;
};

const dependenciesChanged = async (entry: MemoryEntry) => {
  if (!entry.deps || entry.deps.size === 0) {
    return true;
  }

  for (const [filePath, mtime] of Array.from(entry.deps.entries())) {
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

const getRollupOutput = async (cacheKey: string, entryPath: string, servePath: string, force = false) => {
  const normalizedServePath = normalizeServeFileName(servePath);
  let entry = memoryCache.get(cacheKey);

  if (!entry) {
    entry = {};
    memoryCache.set(cacheKey, entry);
  }

  if (!force && entry.output && !(await dependenciesChanged(entry))) {
    return entry.output;
  }

  if (!entry.pending) {
    entry.pending = (async () => {
      const inputOptions = {
        ...createInputOptions(entryPath),
        cache: entry.cache,
      };

      const bundle = await rollupBuild(inputOptions);

      try {
        const outputOptions = createOutputOptions(normalizedServePath);
        const output = await bundle.generate(outputOptions);

        entry.cache = bundle.cache;
        entry.output = output;
        entry.deps = await collectDependencies(bundle);

        return output;
      } finally {
        await bundle.close();
      }
    })().finally(() => {
      if (entry) {
        entry.pending = undefined;
      }
    });
  }

  return entry.pending;
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

const writeRollupOutput = async (buildPath: string, output: RollupOutput) => {
  for (const item of output.output) {
    const destination = path.join(buildPath, item.fileName);
    await ensureDir(path.dirname(destination));

    if (item.type === 'asset') {
      if (typeof item.source === 'string') {
        await writeFile(destination, item.source, 'utf8');
      } else {
        const data = item.source instanceof Uint8Array ? item.source : new Uint8Array(item.source);
        await writeFile(destination, data);
      }
    } else {
      await writeFile(destination, item.code, 'utf8');
    }
  }
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
  sendResponse: async ({ file, res, next }) => {
    try {
      const cacheKey = makeCacheKey(file.srcPath, file.servePath);
      const output = await getRollupOutput(cacheKey, file.srcPath, file.servePath, false);
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
    const cacheKey = makeCacheKey(file.srcPath, file.servePath);
    const output = await getRollupOutput(cacheKey, file.srcPath, file.servePath, true);
    await writeRollupOutput(buildPath, output);
  },
};
