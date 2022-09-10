import { MultiStaticConfig } from './types';
import { defaultStreamTransformer, defaultTest, defaultWriteContent, mixInCustomPageOptions } from './config';
import { getFilesList, getGlobBasePath } from './utils/files';
import glob from 'glob';
import fs from 'fs-extra';
import path from 'path';
import { reverse } from 'ramda';
import { escapeRegExp } from './utils/helpers';

export const build = async (config: MultiStaticConfig) => {
  const originalCustomOptions = config.customOptions;

  await config.beforeBuild();

  const processedReqPaths = new Set();

  // Copy files according to the list from config.mapping
  for (let [localPath, servePath] of reverse(config.mapping)) {
    servePath = config.mappingBuildLocationRewrite(servePath);

    localPath = path.join(process.cwd(), localPath);
    let localBasePath: string;

    const files = (() => {
      if (glob.hasMagic(localPath)) {
        // Путь без магической части
        localBasePath = getGlobBasePath(localPath);

        return glob.sync(localPath).map((i) => path.resolve(i));
      } else if (fs.lstatSync(localPath).isDirectory()) {
        // Путь как он есть
        localBasePath = localPath;

        return getFilesList(localPath);
      } else {
        // Путь без самого имени файла
        localBasePath = localPath.replace(/\/[^/]+$/, '');

        return [localPath];
      }
    })();

    for (const srcPath of files) {
      const reqPath =
        servePath +
        srcPath
          .replace(new RegExp(`^${escapeRegExp(localBasePath)}`, ''), '')
          .replace(new RegExp(escapeRegExp(path.sep), 'g'), '/');

      if (processedReqPaths.has(reqPath)) {
        continue;
      }
      processedReqPaths.add(reqPath);

      await mixInCustomPageOptions({
        reqPath,
        config,
        originalCustomOptions,
        mode: 'build',
        optionsFileName: config.optionsFileName,
      });

      // ---------------------------

      const mode = 'build';

      if (config.exclude) {
        const excludeResult = await config.exclude(reqPath);
        if (excludeResult) {
          continue;
        }
      }

      // console.log(srcPath, reqPath);

      for (const transformer of [...config.transformers, defaultStreamTransformer]) {
        const file = {
          srcPath,
          reqPath,
        };

        const ctx = {};

        const customOptions = config.customOptions;

        // 0) Before test
        if (transformer.beforeTest) {
          await transformer.beforeTest({ file, mode, ctx, customOptions });
        }

        // 1) Test
        const test = transformer.test || defaultTest;
        if (!(await test({ file, mode, ctx, customOptions }))) {
          continue;
        }

        // 3) Process
        let content: unknown;
        for (const processor of transformer.processors || []) {
          content = await processor({ content, file, mode, ctx, customOptions });
        }

        // 4) Write
        const writeContent = transformer.writeContent || defaultWriteContent;
        await writeContent({ content, file, mode, ctx, customOptions, buildPath: config.buildPath });

        break;
      }
    }
  }

  await config.afterBuild();
};
