const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  customOptions: {
    variables: {
      title: 'site1 page',
      var1: 'originalVar1',
      var2: 'originalVar2',
      var3: 'originalVar3',
    },
  },

  mapping: [
    ['./static/site1', '/root'],
    ['./static/_common', '/root'],
  ],
};
