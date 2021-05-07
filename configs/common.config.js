const fs = require('fs-extra');
const _ = require('lodash');
const sass = require('node-sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const { defaultFileDevProcessing, defaultFileBuildProcessing } = require('../scripts/common');

const processScssFile = (scssFile) => {
  const sassResult = sass.renderSync({
    file: scssFile,
  });
  const postCssResult = postcss([autoprefixer({})]).process(sassResult.css);

  return postCssResult.toString();
};

module.exports = {
  http: {
    port: 3003,
    https: true,
    key: fs.readFileSync('./node_modules/localhost-certs/files/server.key', 'utf8'),
    cert: fs.readFileSync('./node_modules/localhost-certs/files/server.crt', 'utf8'),
  },
  fileDevProcessing(params) {
    const { fileSrc, res, next } = params;

    // Если это css - пробуем найти scss и отдать его скомпиленное содержимое
    if (fileSrc.endsWith('.css')) {
      const scssFile = fileSrc.replace(new RegExp(`${_.escapeRegExp('.css')}$`), '.scss');
      if (fs.pathExistsSync(scssFile)) {
        const cssContent = processScssFile(scssFile);
        res.setHeader('Content-Type', 'text/css');

        return res.send(cssContent.toString());
      }
    }

    return defaultFileDevProcessing(params);
  },
  fileBuildProcessing(params) {
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

    return defaultFileBuildProcessing(params);
  },
  welcomeMessage: 'hello from common.config',
};
