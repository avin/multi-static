const fs = require('fs-extra');

module.exports = function readFirstLine(filePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(filePath, { encoding: 'utf8' });
    let acc = '';
    let pos = 0;
    let index;
    rs.on('data', function (chunk) {
      index = chunk.indexOf('\n');
      acc += chunk;
      index !== -1 ? rs.close() : (pos += chunk.length);
    })
      .on('close', function () {
        resolve(acc.slice(0, pos + index));
      })
      .on('error', function (err) {
        reject(err);
      });
  });
};
