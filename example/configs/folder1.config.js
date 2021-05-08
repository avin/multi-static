const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  options: {
    pageVariables: {
      title: 'Folder1 page',
    },
  },

  mapping: [
    ['./static/folder1', '/root'],
    ['./static/_common', '/root'],
  ],
};
