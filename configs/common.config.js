const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const sass = require('node-sass');
const postcss = require('postcss');
const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const { defaultFileDevProcessing, defaultFileBuildProcessing } = require('../scripts/common');
const readFirstLine = require('./utils/readFirstLine');
const generateWebpackConfig = require('./utils/generateWebpackConfig');
const webpackDevMiddleware = require('webpack-dev-middleware');

const processScssFile = (scssFile) => {
  const sassResult = sass.renderSync({
    file: scssFile,
  });
  const postCssResult = postcss([autoprefixer({})]).process(sassResult.css);

  return postCssResult.toString();
};

const _webpackMiddlewaresCache = {};

module.exports = {
  http: {
    port: 3003,
    https: true,
    key: fs.readFileSync('./node_modules/localhost-certs/files/server.key', 'utf8'),
    cert: fs.readFileSync('./node_modules/localhost-certs/files/server.crt', 'utf8'),
  },
  async fileDevProcessing(params) {
    const { fileSrc, req, res, next } = params;

    // Если это css - пробуем найти scss и отдать его скомпиленное содержимое
    if (fileSrc.endsWith('.css')) {
      const scssFile = fileSrc.replace(new RegExp(`${_.escapeRegExp('.css')}$`), '.scss');
      if (fs.pathExistsSync(scssFile)) {
        const cssContent = processScssFile(scssFile);
        res.setHeader('Content-Type', 'text/css');

        return res.send(cssContent.toString());
      }
    }

    // Если js файл с первой строчкой "// @process" - прогоняем через webpack
    if (fileSrc.endsWith('.js')) {
      if (fs.pathExistsSync(fileSrc)) {
        const firstLine = await readFirstLine(fileSrc);
        if (firstLine === '// @process') {
          let cachedWebpackMiddleware = _webpackMiddlewaresCache[fileSrc];

          if (!cachedWebpackMiddleware) {
            const dstArr = req.path.split('/');
            const dstFileName = dstArr.slice(-1)[0];
            const dstPath = dstArr.slice(0, -1).join('/');

            const config = generateWebpackConfig({
              mode: 'development',
              src: fileSrc,

              filename: dstFileName,
              publicPath: dstPath,
            });

            cachedWebpackMiddleware = webpackDevMiddleware(webpack(config), {
              publicPath: config.output.publicPath,
              stats: 'errors-only',
            });
            _webpackMiddlewaresCache[fileSrc] = cachedWebpackMiddleware;
          }

          return cachedWebpackMiddleware(req, res, next);
        }
      }
    }

    return defaultFileDevProcessing(params);
  },
  async fileBuildProcessing(params) {
    const { fileSrc, destinationFileSrc } = params;

    // Если это scss - в билд попадет css файл с транспилленным содержимым оригинальной scss
    if (fileSrc.endsWith('.scss')) {
      const scssFileSrc = fileSrc;
      const cssDestinationFileSrc = destinationFileSrc.replace(
        new RegExp(`${_.escapeRegExp('.scss')}$`),
        '.css'
      );

      if (!fs.pathExistsSync(cssDestinationFileSrc) && fs.pathExistsSync(scssFileSrc)) {
        const cssContent = processScssFile(scssFileSrc);

        fs.ensureFileSync(cssDestinationFileSrc);
        fs.writeFileSync(cssDestinationFileSrc, cssContent);
        return;
      }
    }

    // Если js файл с первой строчкой "// @process" - прогоняем через webpack
    if (fileSrc.endsWith('.js')) {
      if (!fs.pathExistsSync(destinationFileSrc)) {
        const firstLine = await readFirstLine(fileSrc);
        if (firstLine === '// @process') {
          const dstArr = destinationFileSrc.split(path.sep);
          const dstFileName = dstArr.slice(-1)[0];
          const dstPath = dstArr.slice(0, -1).join('/');

          const config = generateWebpackConfig({
            mode: 'production',
            src: fileSrc,

            filename: dstFileName,
            path: path.resolve(dstPath),
            publicPath: '',
          });

          await new Promise((resolve, reject) => {
            webpack(config, (err, stats) => {
              if (err) {
                return reject();
              }
              resolve();
            });
          });

          return;
        }
      }
    }

    return defaultFileBuildProcessing(params);
  },
};
