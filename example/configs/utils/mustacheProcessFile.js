const fs = require('fs-extra');
const path = require('path');
const safeEval = require('./safeEval');
const Mustache = require('mustache');

const mustacheProcessFile = (fileSrc, variables = {}) => {
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
          chunkContent = mustacheProcessFile(chunkFile, 'utf8');
        } catch (e) {
          console.warn(`(!) Chunk read error. ${chunkFile}`);
        }

        return chunkContent || '';
      };
    },
    ...variables,
  });
};

module.exports = mustacheProcessFile;
