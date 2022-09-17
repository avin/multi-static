const sass = require('sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const path = require('path');

const processScssFile = (scssFile) => {
  try {
    const sassResult = sass.compile(scssFile, { loadPaths: [path.join(process.cwd())] });
    const postCssResult = postcss([autoprefixer({})]).process(sassResult.css);

    return postCssResult.toString();
  } catch (e) {
    console.warn(`process ${scssFile} error`);
    console.warn(e);

    if (exitOnFail) {
      process.exit(1);
    }
  }

  return '';
};

module.exports = processScssFile;
