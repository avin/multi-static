const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  mapping: [
    ['./static/folder1', '/root'],
    ['./static/_common', '/root'],
  ],
};
