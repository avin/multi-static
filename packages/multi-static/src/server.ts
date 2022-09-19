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
import { hasUnderscoreAtFileNameStart, relativePath, uniPathSep } from './utils/helpers';

export const startServer = async (config: MultiStaticConfig): Promise<https.Server | http.Server> => {
  const originalCustomOptions = config.customOptions;

  const app = express();

  if (config.onBeforeSetupMiddleware) {
    await config.onBeforeSetupMiddleware({ app, config });
  }

  // Headers suppressing the cache in the browser
  app.use((req, res, next) => {
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  });

  app.use(async function (req, res, next) {
    const servePath = req.path;
    await mixInCustomPageOptions({
      servePath,
      config,
      originalCustomOptions,
      mode: 'dev',
      customOptionsFileName: config.customOptionsFileName,
    });

    // ---------------------------

    for (let [srcLocation, serveLocation] of config.mapping) {
      serveLocation = config.rewriteServeLocationInDevMode(serveLocation);

      srcLocation = path.join(process.cwd(), srcLocation);

      // Если роут попадает под условие serveLocation
      if (pathBelongsTo(servePath, serveLocation)) {
        const subServePath = relativePath(servePath, serveLocation);

        let fileSrc: string | undefined;

        let shouldExclude = true;
        if (glob.hasMagic(srcLocation)) {
          // Если glob
          const filePaths = glob.sync(srcLocation).map((i) => path.resolve(i));

          filePaths.forEach((filePath) => {
            // Часть пути до файла в основе которой магия glob
            const globFilePart = relativePath(filePath, getGlobBasePath(srcLocation));

            if (uniPathSep(globFilePart, '/') === subServePath) {
              fileSrc = filePath;
            }
          });
        } else if (
          fs.existsSync(srcLocation) &&
          !fs.lstatSync(srcLocation).isDirectory() &&
          srcLocation.endsWith(subServePath)
        ) {
          // Если соло-файл
          fileSrc = srcLocation;
          shouldExclude = false;
        } else {
          // Если папка
          fileSrc = path.join(srcLocation, subServePath);
        }

        if (shouldExclude) {
          if (hasUnderscoreAtFileNameStart(servePath)) {
            continue;
          }
        }

        if (fileSrc) {
          const mode = 'dev';

          for (const transformer of [...config.transformers, defaultStreamTransformer]) {
            const file = {
              srcPath: fileSrc,
              dstPath: path.join(config.buildPath, servePath),
              servePath,
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

  if (config.onAfterSetupMiddleware) {
    await config.onAfterSetupMiddleware({ app, config });
  }

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

  if (config.onListening) {
    await config.onListening({ app, config, server });
  }

  return server;
};
