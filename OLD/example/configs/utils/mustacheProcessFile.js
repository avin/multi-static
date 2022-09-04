const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const safeEval = require('./safeEval');
const Mustache = require('mustache');

Mustache.escape = (text) => text;

/**
 * Пропустить файл через mustache
 * @param fileSrc
 * @param customOptions
 * @param originalFileSrc - изначальный обрабатываемый файл (для случаев когда происходит обработка внутренних чанков)
 * @returns {*}
 */
const mustacheProcessFile = (fileSrc, customOptions = {}, originalFileSrc) => {
  let data = fs.readFileSync(fileSrc, 'utf8');

  return Mustache.render(data, {
    eval: () => {
      return (text, render) => {
        return render(String(safeEval(text)));
      };
    },
    chunk: () => {
      return (text, render) => {
        const chunkLocation = fileSrc.split(path.sep).slice(0, -1).join(path.sep);
        const chunkFile = path.join(chunkLocation, text);
        let chunkContent;
        try {
          chunkContent = mustacheProcessFile(chunkFile, customOptions, originalFileSrc || fileSrc);
        } catch (e) {
          console.warn(`(!) Chunk read error. ${chunkFile}`);
        }

        return chunkContent || '';
      };
    },
    translate: () => {
      return (text, render) => {
        const execResult = /_([a-z]+)\.html/.exec(originalFileSrc || fileSrc);
        const lang = execResult && execResult[1];

        if (lang) {
          return _.get(customOptions, ['translations', ...text.split('.'), lang], text);
        }

        return text;
      };
    },
    ...customOptions.variables,
  });
};

module.exports = mustacheProcessFile;
