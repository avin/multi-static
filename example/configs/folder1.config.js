const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  customOptions: {
    variables: {
      title: 'Folder1 page',
      var1: 'originalVar1',
      var2: 'originalVar2',
      var3: 'originalVar3',
    },
  },

  mapping: [
    ['./static/folder1', '/root'],
    ['./static/_common', '/root'],
  ],
};
