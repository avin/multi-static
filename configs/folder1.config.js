const fs = require('fs-extra');
const _ = require('lodash');
const sass = require('node-sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const { defaultFileDevProcessing, defaultFileBuildProcessing } = require('../scripts/common');

module.exports = {
  http: {
    port: 3003,
    https: true,
    key: fs.readFileSync('./node_modules/localhost-certs/files/server.key', 'utf8'),
    cert: fs.readFileSync('./node_modules/localhost-certs/files/server.crt', 'utf8'),
  },
  mapping: [
    ['./static/folder1', '/root'],
    ['./static/_common', '/root'],
  ],
  fileDevProcessing: (params) => {
    const { fileSrc, res, next } = params;

    // Если это css - пробуем найти scss и отдать его скомпиленное содержимое
    if (fileSrc.endsWith('.css')) {
      const scssFile = fileSrc.replace(new RegExp(`${_.escapeRegExp('.css')}$`), '.scss');
      if (fs.pathExistsSync(scssFile)) {
        const sassResult = sass.renderSync({
          file: scssFile,
        });
        const postCssResult = postcss([autoprefixer({})]).process(sassResult.css);
        res.setHeader('Content-Type', 'text/css');

        return res.send(postCssResult.toString());
      }
    }

    return defaultFileDevProcessing(params);
  },
  fileBuildProcessing: (params) => {
    const { fileSrc, destinationFileSrc } = params;

    // Если это css - пробуем найти scss и отдать его скомпиленное содержимое
    if (fileSrc.endsWith('.scss')) {
      console.log('++', fileSrc);
      const scssFileSrc = fileSrc;
      const cssDestinationFileSrc = destinationFileSrc.replace(
        new RegExp(`${_.escapeRegExp('.scss')}$`),
        '.css'
      );

      if (!fs.pathExistsSync(cssDestinationFileSrc) && fs.pathExistsSync(scssFileSrc)) {
        const sassResult = sass.renderSync({
          file: scssFileSrc,
        });
        const postCssResult = postcss([autoprefixer({})]).process(sassResult.css);

        fs.ensureFileSync(cssDestinationFileSrc);
        fs.writeFileSync(cssDestinationFileSrc, postCssResult.toString());
        return;
      }
    }

    return defaultFileBuildProcessing(params);
  },
  welcomeMessage: 'hello from folder1.config',
};
