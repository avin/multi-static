const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const sass = require('node-sass');
const postcss = require('postcss');
const mockerApi = require('mocker-api');
const webpack = require('webpack');
const cheerio = require('cheerio');
const autoprefixer = require('autoprefixer');
const {
  defaultFileDevProcessing,
  defaultFileBuildProcessing,
  getFilesList,
} = require('multi-static/common');
const readFirstLine = require('./utils/readFirstLine');
const generateWebpackConfig = require('./utils/generateWebpackConfig');
const processFileTag = require('./utils/processFileTag');
const webpackDevMiddleware = require('webpack-dev-middleware');
const mustacheProcessFile = require('./utils/mustacheProcessFile');

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

    // If it is css, try to find scss and give its compiled content
    if (fileSrc.endsWith('.css')) {
      const scssFile = fileSrc.replace(new RegExp(`${_.escapeRegExp('.css')}$`), '.scss');
      if (fs.pathExistsSync(scssFile)) {
        const cssContent = processScssFile(scssFile);
        res.setHeader('Content-Type', 'text/css');

        return res.send(cssContent.toString());
      }
    }

    // If the js file with the first line "// @process" - run through webpack
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

    // If html files - do the processing of calculated lines in files
    if (fileSrc.endsWith('.html') && fs.pathExistsSync(fileSrc)) {
      const data = mustacheProcessFile(fileSrc, _.get(this, ['options', 'pageVariables'], {}));

      res.setHeader('Content-Type', 'text/html');
      return res.send(data);
    }

    return defaultFileDevProcessing(params);
  },
  async fileBuildProcessing(params) {
    const { fileSrc, destinationFileSrc } = params;

    // If it is ".scss" - the css file with transpiled content of the original scss will get into the build
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

    // If the ".js" file with the first line "// @process" - run through webpack
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

    // If ".html" files - we do the processing of calculated lines in files
    if (fileSrc.endsWith('.html') && !fs.pathExistsSync(destinationFileSrc)) {
      const data = mustacheProcessFile(fileSrc, _.get(this, ['options', 'pageVariables'], {}));

      fs.ensureFileSync(destinationFileSrc);
      fs.writeFileSync(destinationFileSrc, data);
      return;
    }

    return defaultFileBuildProcessing(params);
  },

  beforeBuild() {
    console.log('+++++++ beforeBuild');
  },

  afterBuild() {
    console.log('+++++++ afterBuild');

    const htmlFiles = getFilesList('./build').filter((i) => i.endsWith('.html'));

    // Process tags with links to files and substitute prefixes with hashes for links
    for (const htmlFile of htmlFiles) {
      let content = fs.readFileSync(htmlFile, 'utf8');

      // Parse HTML content
      const $ = cheerio.load(content, {
        decodeEntities: false,
      });

      // Processing links to scripts
      content = processFileTag(content, {
        $,
        tagSelector: 'script',
        fileAttr: 'src',
        htmlFile,
        withIntegrity: false,
      });

      // Processing links to styles
      content = processFileTag(content, {
        $,
        tagSelector: 'link[rel="stylesheet"]',
        fileAttr: 'href',
        htmlFile,
      });

      fs.writeFileSync(htmlFile, content);
    }
  },

  beforeDevStart(app) {
    mockerApi(app, path.resolve(__dirname, './mockerApi/index.js'));
  },
};
