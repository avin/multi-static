import { MultiStaticConfig } from './types';
import {
  defaultTest,
  defaultTransformer,
  defaultWriteContent,
  getFilesList,
  getGlobBasePath,
  mixInCustomPageOptions,
} from './utils';
import glob from 'glob';
import fs from 'fs-extra';
import escapeRegExp from 'lodash/escapeRegExp';
import path from 'path';

export const build = async (config: MultiStaticConfig) => {
  const originalCustomOptions = config.customOptions;

  await config.beforeBuild();

  // Copy files according to the list from config.mapping
  for (let [staticPath, serveLocation] of config.mapping) {
    serveLocation = config.mappingBuildLocationRewrite(serveLocation);

    const buildPath = path.join(config.buildPath, serveLocation);

    const staticFilesPath = path.join(process.cwd(), staticPath);
    let staticFilesBasePath: string;

    const files = (() => {
      if (glob.hasMagic(staticFilesPath)) {
        // Путь без магической части
        staticFilesBasePath = path.join(process.cwd(), getGlobBasePath(staticPath));

        return glob.sync(staticFilesPath).map((i) => path.resolve(i));
      } else {
        if (fs.lstatSync(staticFilesPath).isDirectory()) {
          // Путь как он есть
          staticFilesBasePath = staticFilesPath;

          return getFilesList(staticFilesPath);
        } else {
          // Путь без самого имени файла
          staticFilesBasePath = path.join(process.cwd(), staticPath.replace(/\/[^/]+$/, ''));

          return [staticFilesPath];
        }
      }
    })();

    for (const fileSrc of files) {
      const reqPath =
        serveLocation +
        fileSrc
          .replace(new RegExp(`^${escapeRegExp(staticFilesBasePath)}`, ''), '')
          .replace(new RegExp(escapeRegExp(path.sep), 'g'), '/');

      mixInCustomPageOptions({
        reqPath,
        config,
        originalCustomOptions,
        mode: 'build',
        optionsFileName: config.optionsFileName,
      });

      // ---------------------------

      const destinationFileSrc = fileSrc.replace(new RegExp(`^${escapeRegExp(staticFilesBasePath)}`), buildPath);

      const mode = 'build';

      for (const transformer of [...config.transformers, defaultTransformer]) {
        const file = {
          srcPath: fileSrc,
          dstPath: destinationFileSrc,
        };

        const ctx = {};

        // 0) Before test
        if (transformer.beforeTest) {
          await transformer.beforeTest({ file, mode, ctx });
        }

        // 1) Test
        const test = transformer.test || defaultTest;
        if (!(await test({ file, mode, ctx }))) {
          continue;
        }

        // 3) Process
        let content;
        for (const processor of transformer.processors || []) {
          content = await processor({ content, file, mode, ctx });
        }

        // 4) Write
        const writeContent = transformer.writeContent || defaultWriteContent;
        await writeContent({ content, file, mode, ctx });

        break;
      }
    }
  }

  await config.afterBuild();
};
