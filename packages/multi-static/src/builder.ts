import { MultiStaticConfig } from './types';
import {
  defaultFileReader,
  defaultStreamTransformer,
  defaultTest,
  defaultWriteContent,
  mixInCustomPageOptions,
} from './config';
import { getFilesList, getGlobBasePath } from './utils/files';
import glob from 'glob';
import fs from 'fs-extra';
import path from 'path';
import { escapeRegExp, hasUnderscoreAtFileNameStart, relativePath } from './utils/helpers';

export const build = async (config: MultiStaticConfig) => {
  const originalCustomOptions = config.customOptions;

  if (config.onBeforeBuild) {
    await config.onBeforeBuild({ config });
  }

  const processedServePaths = new Set();

  // Copy files according to the list from config.mapping
  for (let [srcLocation, serveLocation] of config.mapping) {
    serveLocation = config.rewriteServeLocationInBuildMode(serveLocation);

    srcLocation = path.join(process.cwd(), srcLocation);
    let srcBasePath!: string;

    const files = (() => {
      if (glob.hasMagic(srcLocation)) {
        // Путь без магической части
        srcBasePath = getGlobBasePath(srcLocation);

        return glob
          .sync(srcLocation)
          .map((i) => path.resolve(i))
          .filter((filePath) => {
            filePath = relativePath(filePath, srcBasePath);
            const isExcluded = hasUnderscoreAtFileNameStart(filePath);
            return !isExcluded;
          });
      } else if (fs.lstatSync(srcLocation).isDirectory()) {
        // Путь как он есть
        srcBasePath = srcLocation;

        return getFilesList(srcLocation, [], { exclude: hasUnderscoreAtFileNameStart });
      } else {
        // Соло файл
        return [srcLocation];
      }
    })();

    for (const srcPath of files) {
      const servePath = (() => {
        if (!srcBasePath) {
          return serveLocation;
        }
        return (
          serveLocation +
          srcPath
            .replace(new RegExp(`^${escapeRegExp(srcBasePath)}`, ''), '')
            .replace(new RegExp(escapeRegExp(path.sep), 'g'), '/')
        );
      })();

      if (processedServePaths.has(servePath)) {
        continue;
      }
      processedServePaths.add(servePath);

      await mixInCustomPageOptions({
        servePath,
        config,
        originalCustomOptions,
        mode: 'build',
        customOptionsFileName: config.customOptionsFileName,
      });

      // ---------------------------

      const mode = 'build';

      for (const transformer of [...config.transformers, defaultStreamTransformer]) {
        const file = {
          srcPath,
          servePath,
        };

        const ctx = {};

        const customOptions = config.customOptions;

        // 0) Before test
        if (transformer.beforeTest) {
          await transformer.beforeTest({ file, mode, ctx, customOptions });
        }

        // Check if file already exists - then skip
        const dstPath = path.join(config.buildPath, file.servePath);
        if (await fs.pathExists(dstPath)) {
          continue;
        }

        // 1) Test
        const test = transformer.test || defaultTest;
        if (!(await test({ file, mode, ctx, customOptions }))) {
          continue;
        }

        // 3) Process
        let content: unknown;
        for (const processor of transformer.processors || [defaultFileReader]) {
          content = await processor({ content, file, mode, ctx, customOptions });
        }

        // 4) Write
        const writeContent = transformer.writeContent || defaultWriteContent;
        await writeContent({ content, file, mode, ctx, customOptions, buildPath: config.buildPath });

        break;
      }
    }
  }

  if (config.onAfterBuild) {
    await config.onAfterBuild({ config });
  }
};
