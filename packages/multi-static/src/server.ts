import { MultiStaticConfig } from './types';
import express from 'express';
import path from 'path';
import https from 'https';
import http from 'http';
import glob from 'glob';
import fs from 'fs';
import { AddressInfo } from 'net';
import {
  defaultFileReader,
  defaultSendResponse,
  defaultStreamTransformer,
  defaultTest,
  mixInCustomPageOptions,
} from './config';
import { getGlobBasePath, pathBelongsTo } from './utils/files';
import { reverse } from 'ramda';
import { hasUnderscoreAtFileNameStart, relativePath, uniPathSep } from './utils/helpers';

export const startServer = async (config: MultiStaticConfig): Promise<https.Server | http.Server> => {
  const originalCustomOptions = config.customOptions;

  const app = express();

  await config.beforeDevStart({ app });

  // Хедеры пресекающие работу кеша в браузере
  app.use((req, res, next) => {
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  });

  app.use(async function (req, res, next) {
    const reqPath = req.path;
    await mixInCustomPageOptions({
      reqPath,
      config,
      originalCustomOptions,
      mode: 'dev',
      optionsFileName: config.optionsFileName,
    });

    // ---------------------------

    for (let [localPath, servePath] of reverse(config.mapping)) {
      servePath = config.mappingDevLocationRewrite(servePath);

      localPath = path.join(process.cwd(), localPath);

      // Если роут попадает под условие servePath
      if (pathBelongsTo(reqPath, servePath)) {
        const subReqPath = relativePath(reqPath, servePath);

        let fileSrc: string | undefined;

        let shouldExclude = true;
        if (glob.hasMagic(localPath)) {
          // Если glob
          const filePaths = glob.sync(localPath).map((i) => path.resolve(i));

          filePaths.forEach((filePath) => {
            // Часть пути до файла в основе которой магия glob
            const globFilePart = relativePath(filePath, getGlobBasePath(localPath));

            if (uniPathSep(globFilePart, '/') === subReqPath) {
              fileSrc = filePath;
            }
          });
        } else if (
          fs.existsSync(localPath) &&
          !fs.lstatSync(localPath).isDirectory() &&
          localPath.endsWith(subReqPath)
        ) {
          // Если соло-файл
          fileSrc = localPath;
          shouldExclude = false;
        } else {
          // Если папка
          fileSrc = path.join(localPath, subReqPath);
        }

        if (shouldExclude) {
          if (hasUnderscoreAtFileNameStart(reqPath)) {
            continue;
          }
        }

        if (fileSrc) {
          const mode = 'dev';

          for (const transformer of [...config.transformers, defaultStreamTransformer]) {
            const file = {
              srcPath: fileSrc,
              dstPath: path.join(config.buildPath, reqPath),
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
            for (const processor of transformer.processors || [defaultFileReader]) {
              content = await processor({ content, file, mode, ctx, customOptions });
            }

            // 4) Send response
            const sendResponse = transformer.sendResponse || defaultSendResponse;
            await sendResponse({ content, file, res, req, next, mode, ctx, customOptions });

            return;
          }
        }
      }
    }

    next();
  });

  const isHttps = !!config.http.key && !!config.http.cert;

  const server = (() => {
    if (isHttps) {
      return https.createServer({ key: config.http.key, cert: config.http.cert }, app);
    }
    return http.createServer(app);
  })();

  server.listen(config.http.port);
  const port = (server.address() as AddressInfo).port;
  console.info(`${isHttps ? 'https' : 'http'}://localhost:${port}/`);

  return server;
};
