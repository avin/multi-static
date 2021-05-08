const sass = require('node-sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

const processScssFile = (scssFile) => {
  try {
    const sassResult = sass.renderSync({
      file: scssFile,
    });
    const postCssResult = postcss([autoprefixer({})]).process(sassResult.css);

    return postCssResult.toString();
  } catch (e) {
    console.warn(`process ${scssFile} error`);
    console.warn(e);
  }

  return '';
};

module.exports = processScssFile;
