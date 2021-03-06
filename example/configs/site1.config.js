const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  customOptions: {
    variables: {
      title: 'site1 page',
      var1: 'originalVar1',
      var2: 'originalVar2',
      var3: 'originalVar3',
      var4: 'originalVar4',
    },
  },

  mapping: [
    ['./static/site1', '/root'],
    ['./static/_common', '/root'],
    ['./static/_common/foo.json', '/root/page1/foo.json'],
  ],
};
