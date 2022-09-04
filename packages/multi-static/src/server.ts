import { MultiStaticConfig } from './types';
import express from 'express';
import escapeRegExp from 'lodash/escapeRegExp';
import path from 'path';
import https from 'https';
import http from 'http';
import { getGlobBasePath, mixInCustomPageOptions } from './utils';
// import glob from 'fast-glob';
import glob from 'glob';
import fs from 'fs';
import { AddressInfo } from 'net';

export const startServer = async (config: MultiStaticConfig): Promise<https.Server | http.Server> => {
  const originalCustomOptions = config.customOptions;

  const app = express();

  await config.beforeDevStart(app);

  // Хедеры пресекающие работу кеша в браузере
  app.use((req, res, next) => {
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  });

  app.use(async function (req, res, next) {
    mixInCustomPageOptions({
      reqPath: req.path,
      config,
      originalCustomOptions,
      mode: 'dev',
      optionsFileName: config.optionsFileName,
    });

    // ---------------------------

    for (let [staticPath, serveLocation] of config.mapping) {
      serveLocation = config.mappingDevLocationRewrite(serveLocation);

      // Если роут попадает под условие serveLocation
      if (req.path.startsWith(serveLocation)) {
        const cleanServeLocation = req.path.replace(new RegExp(`^${escapeRegExp(serveLocation)}`, ''), '');

        let fileSrc: string | undefined;

        if (glob.hasMagic(staticPath)) {
          // Если glob
          const filePaths = glob.sync(staticPath);

          filePaths.forEach((filePath) => {
            // Часть пути до файла в основе которой магия glob
            const globFilePart = filePath.replace(new RegExp(`^${escapeRegExp(getGlobBasePath(staticPath))}`), '');

            if (globFilePart === cleanServeLocation) {
              fileSrc = path.join(process.cwd(), filePath);
            }
          });
        } else {
          const baseFileSrc = path.join(process.cwd(), staticPath);

          if (
            fs.existsSync(baseFileSrc) &&
            !fs.lstatSync(baseFileSrc).isDirectory() &&
            staticPath.endsWith(cleanServeLocation)
          ) {
            // Если соло-файл
            fileSrc = baseFileSrc;
          } else {
            // Если папка
            fileSrc = path.join(process.cwd(), staticPath, cleanServeLocation);
          }
        }

        if (fileSrc) {
          const success = await config.fileDevProcessing({ fileSrc, req, res, next });
          if (success) {
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
