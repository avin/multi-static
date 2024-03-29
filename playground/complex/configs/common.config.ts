/* eslint-disable */
import fs from 'fs-extra';
import localhostCerts from 'localhost-certs';
import { defineConfig, makeTest, getFilesList } from 'multi-static';
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

  transformers: [
    // ------------
    // *.SCSS -> CSS
    // ------------
    {
      beforeTest: ({ file, mode }) => {
        file.servePath = file.servePath.replace(/\.scss$/, '.css');
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
          const servePathArr = file.servePath.split('/');
          const reqFileName = servePathArr.slice(-1)[0];
          const reqFolder = servePathArr.slice(0, -1).join('/');

          const config = generateWebpackConfig({
            mode: 'development',
            src: file.srcPath,

            filename: reqFileName,
            publicPath: reqFolder,
          });

          cachedWebpackMiddleware = webpackDevMiddleware(webpack(config), {
            publicPath: config.output.publicPath,
            stats: 'errors-only',
          });
          _webpackMiddlewaresCache[file.srcPath] = cachedWebpackMiddleware;
        }

        cachedWebpackMiddleware(req, res, next);
      },
      writeContent: async ({ file, buildPath }) => {
        const dstArr = file.servePath.split('/');
        const dstFileName = dstArr.slice(-1)[0];
        const dstFolder = dstArr.slice(0, -1).join('/');

        const config = generateWebpackConfig({
          mode: 'production',
          src: file.srcPath,

          filename: dstFileName,
          path: path.join(buildPath, dstFolder),
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

  onBeforeBuild({ config }) {
    console.info('> onBeforeBuild start...');

    console.info(`+ removing ${config.buildPath}`);
    fs.removeSync(config.buildPath as string);

    console.info('> onBeforeBuild end.\n');
  },

  exclude(filePath) {
    const pathParts = filePath.split(/\//);
    for (const regexp of [/^_/, /^node_modules$/, /^exclude/]) {
      for (const part of pathParts) {
        if (regexp.test(part)) {
          return true;
        }
      }
    }
    return false;
  },

  onAfterBuild({ config }) {
    console.info('> onAfterBuild start...');

    // Process tags with links to files and substitute prefixes with hashes for links
    getFilesList(config.buildPath)
      .filter((i) => i.endsWith('.html'))
      .forEach((htmlFile) => {
        staticHashVersion({
          htmlFilePath: htmlFile,
          writeToFile: true,
        });
      });

    console.info('> onAfterBuild end\n');
  },

  onBeforeSetupMiddleware({ app }) {
    mockerApi(app, path.resolve(__dirname, './mockerApi/index.js'));
  },
});
