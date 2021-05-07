const argv = require('yargs').argv;
const path = require('path');
const https = require('https');
const _ = require('lodash');
const fs = require('fs-extra');
const express = require('express');
const mime = require('mime-types');
const { readConfig } = require('./common');

// Грузим конфигурацию пользователя
const config = readConfig(argv.config);

const app = express();

// Ставим хедеры на отключение кеша
app.use((_req, res, next) => {
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
});

app.use(function (req, res, next) {
  for (const [staticPath, serveLocation] of config.mapping) {
    // Если роут попадает под запись маппинга
    if (req.path.startsWith(serveLocation)) {
      const cleanServeLocation = req.path.replace(
        new RegExp(`^${_.escapeRegExp(serveLocation)}`, ''),
        ''
      );

      // Составляем имя файла
      const fileSrc = path.join(process.cwd(), staticPath, cleanServeLocation);

      // Читаем содержимое файла
      let data;
      try {
        data = fs.readFileSync(fileSrc, 'utf8');
      } catch (e) {
        console.log('read error');
      }

      // Если что-то прочиталось - отдаем содержимое
      if (data !== undefined) {

        // TODO тут обработать содержимое

        const mimeType = mime.lookup(cleanServeLocation);
        if (mimeType) {
          res.setHeader('Content-Type', mimeType);
        }

        return res.send(data);
      }
    }
  }

  next();
});

const server = (() => {
  if (config.http.https) {
    return https.createServer({ key: config.http.key, cert: config.http.cert }, app);
  }
  return app;
})();

server.listen(config.http.port, () => {
  console.info(`${config.http.https ? 'https' : 'http'}://localhost:${config.http.port}/`);
});
