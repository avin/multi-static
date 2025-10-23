import path from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { makeTest, Transformer } from 'multi-static';
import { build as viteBuild } from 'vite';
import type { InlineConfig } from 'vite';
import type { OutputAsset, OutputChunk, RollupOutput } from 'rollup';

const staticRoot = path.resolve(process.cwd(), 'static');
const viteConfigFile = path.resolve(process.cwd(), 'configs/transformers/vite-bundle/vite.config.ts');

const createBuildConfig = (entry: string, servePath: string): InlineConfig => {
  const normalizedOutputFile = servePath.replace(/^[\\/]+/, '');
  const posixOutput = normalizedOutputFile.split(path.sep).join(path.posix.sep);
  const outputDir = path.posix.dirname(posixOutput);
  const sanitizePattern = (pattern: string) => pattern.replace(/^\.\//, '');
  const resolvedEntry = path.resolve(entry);

  return {
    configFile: viteConfigFile,
    root: staticRoot,
    logLevel: 'error',
    build: {
      write: false,
      emptyOutDir: false,
      rollupOptions: {
        input: resolvedEntry,
        output: {
          entryFileNames: posixOutput,
          chunkFileNames: sanitizePattern(outputDir === '.' ? '[name].js' : path.posix.join(outputDir, '[name].js')),
          assetFileNames: sanitizePattern(
            outputDir === '.' ? '[name][extname]' : path.posix.join(outputDir, '[name][extname]'),
          ),
        },
      },
    },
  };
};

const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
};

const bundleWithVite = async (entry: string, servePath: string) => {
  const buildConfig = createBuildConfig(entry, servePath);
  const buildResult = await viteBuild(buildConfig);
  const rollupOutputs: RollupOutput[] = Array.isArray(buildResult)
    ? (buildResult as RollupOutput[])
    : [buildResult as RollupOutput];

  return rollupOutputs.flatMap((output) => output.output);
};

const normalizeServeFileName = (servePath: string) =>
  servePath
    .replace(/^[\\/]+/, '')
    .split(path.sep)
    .join(path.posix.sep);

export const viteBundleTransformer: Partial<Transformer> = {
  beforeTest: ({ file, mode }) => {
    const originalServeExt = path.extname(file.servePath);
    const originalSrcExt = path.extname(file.srcPath);

    if (mode === 'build' && ['.ts', '.js'].includes(originalSrcExt) && originalServeExt === '.ts') {
      file.servePath = file.servePath.replace(/\.ts$/, '.js');
    }

    if (['.js', '.ts'].includes(originalSrcExt)) {
      const tsCandidate = file.srcPath.replace(/\.js$/, '.ts');
      if (originalSrcExt === '.js' && existsSync(tsCandidate)) {
        file.srcPath = tsCandidate;
      }
    }
  },
  test: makeTest({
    check: ({ file }) => ['.js', '.ts'].includes(path.extname(file.srcPath)),
    checkFirstLine: (firstLine) => firstLine.trim().startsWith('// @process'),
  }),
  sendResponse: async ({ res, file, next }) => {
    let artifacts: (OutputAsset | OutputChunk)[];
    try {
      artifacts = await bundleWithVite(file.srcPath, file.servePath);
    } catch (error) {
      next(error as Error);
      return;
    }

    const targetFileName = normalizeServeFileName(file.servePath);
    const chunk = artifacts.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.fileName === targetFileName,
    );

    if (!chunk) {
      next(new Error(`Bundle output for ${file.servePath} not found`));
      return;
    }

    res.setHeader('Content-Type', 'application/javascript');
    res.send(chunk.code);
  },
  writeContent: async ({ file, buildPath }) => {
    const artifacts = await bundleWithVite(file.srcPath, file.servePath);

    for (const item of artifacts) {
      const dstPath = path.join(buildPath, item.fileName);
      await ensureDir(path.dirname(dstPath));

      if (item.type === 'asset') {
        const source = typeof item.source === 'string' ? item.source : Buffer.from(item.source);
        await writeFile(dstPath, source);
      } else {
        await writeFile(dstPath, item.code, 'utf8');
      }
    }
  },
};
