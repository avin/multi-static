import fs from 'fs-extra';
import localhostCerts from 'localhost-certs';
import { defineConfig, getFilesList, makeTest } from 'multi-static';
import path from 'path';
import mockerApi from 'mocker-api';
import webpack from 'webpack';
import generateWebpackConfig from './utils/generateWebpackConfig';
import webpackDevMiddleware from 'webpack-dev-middleware';
import mustacheProcessFile from './utils/mustacheProcessFile';
import processScssFile from './utils/processScssFile';
import staticHashVersion from 'static-hash-version';

const _webpackMiddlewaresCache = {};

export default defineConfig({
  http: {
    port: 3003,
    https: true,
    ...localhostCerts(),
  },

  // Исключаем файлы и папки начинающиеся с _подчеркивания
  exclude: (dstPath) => /[\\/]_/.test(dstPath),

  transformers: [
    // ------------
    // *.SCSS -> CSS
    // ------------
    {
      beforeTest: ({ file, mode }) => {
        file.dstPath = file.dstPath.replace(/\.scss$/, '.css');
        file.srcPath = file.srcPath.replace(/\.css$/, '.scss');
      },
      test: makeTest({
        check: ({ file }) => file.srcPath.endsWith('.scss'),
        checkFirstLine: (firstLine) => firstLine.startsWith('// @process'),
      }),
      processors: [
        ({ file }) => {
          return processScssFile(file.srcPath);
        },
      ],
    },

    // ------------
    // *.JS Webpack
    // ------------
    {
      test: makeTest({
        check: ({ file }) => file.srcPath.endsWith('.js'),
        checkFirstLine: (firstLine) => firstLine.startsWith('// @process'),
      }),
      processors: [],
      sendResponse: ({ file, req, res, next }) => {
        let cachedWebpackMiddleware = _webpackMiddlewaresCache[file.srcPath];

        if (!cachedWebpackMiddleware) {
          const dstArr = file.dstPath.split('/');
          const dstFileName = dstArr.slice(-1)[0];
          const dstPath = dstArr.slice(0, -1).join('/');

          const config = generateWebpackConfig({
            mode: 'development',
            src: file.srcPath,

            filename: dstFileName,
            publicPath: dstPath,
          });

          cachedWebpackMiddleware = webpackDevMiddleware(webpack(config), {
            publicPath: config.output.publicPath,
            stats: 'errors-only',
          });
          _webpackMiddlewaresCache[file.srcPath] = cachedWebpackMiddleware;
        }

        cachedWebpackMiddleware(req, res, next);
      },
      writeContent: async ({ file }) => {
        const dstArr = file.dstPath.split(path.sep);
        const dstFileName = dstArr.slice(-1)[0];
        const dstPath = dstArr.slice(0, -1).join('/');

        const config = generateWebpackConfig({
          mode: 'production',
          src: file.srcPath,

          filename: dstFileName,
          path: path.resolve(dstPath),
          publicPath: '',
        });

        await new Promise<void>((resolve, reject) => {
          webpack(config, (err, stats) => {
            const errorsText = stats.toString({ all: false, errors: true });
            if (errorsText) {
              console.log(errorsText);
            }

            if (err) {
              return reject();
            }
            resolve();
          });
        });
      },
    },

    // ------------
    // *.HTML Mustache
    // ------------
    {
      test: makeTest({
        check: ({ file }) => file.srcPath.endsWith('.html'),
      }),
      processors: [
        ({ file, customOptions }) => {
          return mustacheProcessFile(file.srcPath, customOptions);
        },
      ],
    },
  ],

  // async fileDevProcessing(params) {
  //   const { fileSrc, req, res, next } = params;
  //
  //   // ------------
  //   // *.SCSS -> CSS
  //   // ------------
  //   if (fileSrc.endsWith('.css')) {
  //     const scssFile = fileSrc.replace(new RegExp(`${_.escapeRegExp('.css')}$`), '.scss');
  //     if (fs.pathExistsSync(scssFile)) {
  //       const firstLine = await readFirstLine(scssFile);
  //       if (firstLine === '// @process') {
  //         const cssContent = processScssFile(scssFile);
  //         res.setHeader('Content-Type', 'text/css');
  //         res.send(cssContent.toString());
  //
  //         return true;
  //       }
  //     }
  //   }
  //
  //   // ------------
  //   // *.JS Webpack
  //   // ------------
  //   if (fileSrc.endsWith('.js') && fs.pathExistsSync(fileSrc)) {
  //     const firstLine = await readFirstLine(fileSrc);
  //     if (firstLine === '// @process') {
  //       let cachedWebpackMiddleware = _webpackMiddlewaresCache[fileSrc];
  //
  //       if (!cachedWebpackMiddleware) {
  //         const dstArr = req.path.split('/');
  //         const dstFileName = dstArr.slice(-1)[0];
  //         const dstPath = dstArr.slice(0, -1).join('/');
  //
  //         const config = generateWebpackConfig({
  //           mode: 'development',
  //           src: fileSrc,
  //
  //           filename: dstFileName,
  //           publicPath: dstPath,
  //         });
  //
  //         cachedWebpackMiddleware = webpackDevMiddleware(webpack(config), {
  //           publicPath: config.output.publicPath,
  //           stats: 'errors-only',
  //         });
  //         _webpackMiddlewaresCache[fileSrc] = cachedWebpackMiddleware;
  //       }
  //
  //       cachedWebpackMiddleware(req, res, next);
  //
  //       return true;
  //     }
  //   }
  //
  //   // ------------
  //   // *.HTML Mustache
  //   // ------------
  //   if (fileSrc.endsWith('.html') && fs.pathExistsSync(fileSrc)) {
  //     const data = mustacheProcessFile(fileSrc, this.customOptions);
  //
  //     res.setHeader('Content-Type', 'text/html');
  //     res.send(data);
  //
  //     return true;
  //   }
  //
  //   return defaultFileDevProcessing(params);
  // },
  // async fileBuildProcessing(params) {
  //   const { fileSrc, destinationFileSrc } = params;
  //
  //   // ------------
  //   // *.SCSS -> CSS
  //   // ------------
  //   if (fileSrc.endsWith('.scss')) {
  //     const scssFileSrc = fileSrc;
  //     const cssDestinationFileSrc = destinationFileSrc.replace(new RegExp(`${_.escapeRegExp('.scss')}$`), '.css');
  //
  //     if (fs.pathExistsSync(scssFileSrc)) {
  //       if (!fs.pathExistsSync(cssDestinationFileSrc)) {
  //         const firstLine = await readFirstLine(scssFileSrc);
  //         if (firstLine === '// @process') {
  //           const cssContent = processScssFile(scssFileSrc);
  //
  //           fs.ensureFileSync(cssDestinationFileSrc);
  //           fs.writeFileSync(cssDestinationFileSrc, cssContent);
  //           return;
  //         }
  //       } else {
  //         // Если css с таким именем есть, то scss копировать уже не надо
  //         return;
  //       }
  //     }
  //   }
  //
  //   // ------------
  //   // *.JS Webpack
  //   // ------------
  //   if (fileSrc.endsWith('.js')) {
  //     if (!fs.pathExistsSync(destinationFileSrc)) {
  //       const firstLine = await readFirstLine(fileSrc);
  //       if (firstLine === '// @process') {
  //         const dstArr = destinationFileSrc.split(path.sep);
  //         const dstFileName = dstArr.slice(-1)[0];
  //         const dstPath = dstArr.slice(0, -1).join('/');
  //
  //         const config = generateWebpackConfig({
  //           mode: 'production',
  //           src: fileSrc,
  //
  //           filename: dstFileName,
  //           path: path.resolve(dstPath),
  //           publicPath: '',
  //         });
  //
  //         await new Promise((resolve, reject) => {
  //           webpack(config, (err, stats) => {
  //             const errorsText = stats.toString({ all: false, errors: true });
  //             if (errorsText) {
  //               console.log(errorsText);
  //             }
  //
  //             if (err) {
  //               return reject();
  //             }
  //             resolve();
  //           });
  //         });
  //
  //         return;
  //       }
  //     }
  //   }
  //
  //   // ------------
  //   // *.HTML Mustache
  //   // ------------
  //   if (fileSrc.endsWith('.html') && !fs.pathExistsSync(destinationFileSrc)) {
  //     const data = mustacheProcessFile(fileSrc, this.customOptions);
  //
  //     fs.ensureFileSync(destinationFileSrc);
  //     fs.writeFileSync(destinationFileSrc, data);
  //     return;
  //   }
  //
  //   return defaultFileBuildProcessing(params);
  // },

  beforeBuild() {
    console.info('> beforeBuild start...');

    console.info(`+ removing ${this.buildPath}`);
    fs.removeSync(this.buildPath as string);

    console.info('> beforeBuild end.\n');
  },

  afterBuild() {
    console.info('> afterBuild start...');

    // Process tags with links to files and substitute prefixes with hashes for links
    getFilesList('./build')
      .filter((i) => i.endsWith('.html'))
      .forEach((htmlFile) => {
        staticHashVersion({
          htmlFilePath: htmlFile,
          writeToFile: true,
        });
      });

    console.info('> afterBuild end\n');
  },

  beforeDevStart({ app }) {
    mockerApi(app, path.resolve(__dirname, './mockerApi/index.js'));
  },
});
