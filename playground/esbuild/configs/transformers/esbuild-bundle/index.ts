import path from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { makeTest, Transformer } from 'multi-static';
import * as esbuild from 'esbuild';

const staticRoot = path.resolve(process.cwd(), 'static');
const virtualOutDir = path.join(process.cwd(), '.multi-static-esbuild');

type BuildContextEntry = {
  context: esbuild.BuildContext;
  pending?: Promise<esbuild.BuildResult>;
};

const buildCache = new Map<string, BuildContextEntry>();
const registeredContexts = new Set<esbuild.BuildContext>();
let shutdownHooksAttached = false;

const attachShutdownHooks = () => {
  if (shutdownHooksAttached) {
    return;
  }

  const disposeAll = () => {
    for (const ctx of registeredContexts) {
      ctx.dispose().catch(() => {
        // ignore
      });
    }
  };

  process.once('SIGINT', disposeAll);
  process.once('SIGTERM', disposeAll);
  process.once('exit', disposeAll);

  shutdownHooksAttached = true;
};

const toOsPath = (servePath: string) =>
  servePath
    .replace(/^[\\/]+/, '')
    .split('/')
    .join(path.sep);
const toPosixPath = (servePath: string) => servePath.replace(/^[\\/]+/, '').replace(/\\/g, '/');
const makeCacheKey = (entryPath: string, servePath: string) => `${path.resolve(entryPath)}::${servePath}`;

const createBuildOptions = (entryPath: string, servePath: string): esbuild.BuildOptions => {
  const relativeEntry = path.relative(staticRoot, entryPath);
  const normalizedServePath = toOsPath(servePath);

  return {
    absWorkingDir: staticRoot,
    entryPoints: [relativeEntry],
    bundle: true,
    format: 'esm',
    sourcemap: true,
    metafile: true,
    write: false,
    outfile: path.join(virtualOutDir, normalizedServePath),
    logLevel: 'silent',
    target: ['es2018'],
  };
};

const ensureContext = async (cacheKey: string, entryPath: string, servePath: string) => {
  let cacheEntry = buildCache.get(cacheKey);

  if (!cacheEntry) {
    const context = await esbuild.context(createBuildOptions(entryPath, servePath));
    cacheEntry = { context };
    buildCache.set(cacheKey, cacheEntry);
    registeredContexts.add(context);
    attachShutdownHooks();
  }

  return cacheEntry;
};

const disposeContext = async (cacheKey: string) => {
  const cacheEntry = buildCache.get(cacheKey);
  if (!cacheEntry) {
    return;
  }

  buildCache.delete(cacheKey);
  registeredContexts.delete(cacheEntry.context);

  try {
    await cacheEntry.context.dispose();
  } catch (error) {
    // ignore
  }
};

const rebuildWithCache = async (cacheEntry: BuildContextEntry) => {
  if (!cacheEntry.pending) {
    cacheEntry.pending = cacheEntry.context
      .rebuild()
      .then((result) => {
        cacheEntry.pending = undefined;
        return result;
      })
      .catch((error) => {
        cacheEntry.pending = undefined;
        throw error;
      });
  }

  return cacheEntry.pending;
};

const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
};

const findOutputByServePath = (servePath: string, outputFiles: esbuild.OutputFile[]) => {
  const normalized = toPosixPath(servePath);

  for (const file of outputFiles) {
    const relative = path.relative(virtualOutDir, file.path).split(path.sep).join('/');
    if (relative === normalized && file.path.endsWith('.js')) {
      return file;
    }
  }

  return outputFiles.find((file) => file.path.endsWith('.js'));
};

const writeOutputsToBuildDir = async (buildPath: string, outputFiles: esbuild.OutputFile[]) => {
  for (const file of outputFiles) {
    const relative = path.relative(virtualOutDir, file.path).split(path.sep).join(path.posix.sep);
    const destination = path.join(buildPath, relative);
    await ensureDir(path.dirname(destination));
    await writeFile(destination, file.contents);
  }
};

export const esbuildBundleTransformer: Partial<Transformer> = {
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
      const cacheEntry = await ensureContext(cacheKey, file.srcPath, file.servePath);
      const result = await rebuildWithCache(cacheEntry);
      const outputFiles = result.outputFiles || [];

      const jsOutput = findOutputByServePath(file.servePath, outputFiles);
      if (!jsOutput) {
        throw new Error(`esbuild output for ${file.servePath} not found`);
      }

      res.setHeader('Content-Type', 'application/javascript');
      res.send(jsOutput.text);
    } catch (error) {
      next(error as Error);
    }
  },
  writeContent: async ({ file, buildPath, mode }) => {
    const cacheKey = makeCacheKey(file.srcPath, file.servePath);
    const cacheEntry = await ensureContext(cacheKey, file.srcPath, file.servePath);
    const result = await rebuildWithCache(cacheEntry);
    const outputFiles = result.outputFiles || [];

    await writeOutputsToBuildDir(buildPath, outputFiles);

    if (mode === 'build') {
      await disposeContext(cacheKey);
    }
  },
};
