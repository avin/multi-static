const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const mockerApi = require('mocker-api');
const webpack = require('webpack');
const {
  defaultFileDevProcessing,
  defaultFileBuildProcessing,
  getFilesList,
} = require('multi-static/common');
const readFirstLine = require('read-first-line');
const generateWebpackConfig = require('./utils/generateWebpackConfig');
const webpackDevMiddleware = require('webpack-dev-middleware');
const mustacheProcessFile = require('./utils/mustacheProcessFile');
const processScssFile = require('./utils/processScssFile');
const staticHashVersion = require('static-hash-version');

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

    // ------------
    // *.SCSS -> CSS
    // ------------
    if (fileSrc.endsWith('.css')) {
      const scssFile = fileSrc.replace(new RegExp(`${_.escapeRegExp('.css')}$`), '.scss');
      if (fs.pathExistsSync(scssFile)) {
        const firstLine = await readFirstLine(scssFile);
        if (firstLine === '// @process') {
          const cssContent = processScssFile(scssFile);
          res.setHeader('Content-Type', 'text/css');

          return res.send(cssContent.toString());
        }
      }
    }

    // ------------
    // *.JS Webpack
    // ------------
    if (fileSrc.endsWith('.js') && fs.pathExistsSync(fileSrc)) {
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

    // ------------
    // *.HTML Mustache
    // ------------
    if (fileSrc.endsWith('.html') && fs.pathExistsSync(fileSrc)) {
      const data = mustacheProcessFile(fileSrc, _.get(this, ['pageOptions', 'variables'], {}));

      res.setHeader('Content-Type', 'text/html');
      return res.send(data);
    }

    return defaultFileDevProcessing(params);
  },
  async fileBuildProcessing(params) {
    const { fileSrc, destinationFileSrc } = params;

    // ------------
    // *.SCSS -> CSS
    // ------------
    if (fileSrc.endsWith('.scss')) {
      const scssFileSrc = fileSrc;
      const cssDestinationFileSrc = destinationFileSrc.replace(
        new RegExp(`${_.escapeRegExp('.scss')}$`),
        '.css'
      );

      if (!fs.pathExistsSync(cssDestinationFileSrc) && fs.pathExistsSync(scssFileSrc)) {
        const firstLine = await readFirstLine(scssFileSrc);
        if (firstLine === '// @process') {
          const cssContent = processScssFile(scssFileSrc);

          fs.ensureFileSync(cssDestinationFileSrc);
          fs.writeFileSync(cssDestinationFileSrc, cssContent);
          return;
        }
      }
    }

    // ------------
    // *.JS Webpack
    // ------------
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

    // ------------
    // *.HTML Mustache
    // ------------
    if (fileSrc.endsWith('.html') && !fs.pathExistsSync(destinationFileSrc)) {
      const data = mustacheProcessFile(fileSrc, _.get(this, ['pageOptions', 'variables'], {}));

      fs.ensureFileSync(destinationFileSrc);
      fs.writeFileSync(destinationFileSrc, data);
      return;
    }

    return defaultFileBuildProcessing(params);
  },

  beforeBuild() {
    console.log('> beforeBuild task running...');
  },

  afterBuild() {
    console.log('> afterBuild task running...');

    // Process tags with links to files and substitute prefixes with hashes for links
    getFilesList('./build')
      .filter((i) => i.endsWith('.html'))
      .forEach((htmlFile) => {
        staticHashVersion({
          htmlFilePath: htmlFile,
          writeToFile: true,
        });
      });
  },

  beforeDevStart(app) {
    mockerApi(app, path.resolve(__dirname, './mockerApi/index.js'));
  },
};
