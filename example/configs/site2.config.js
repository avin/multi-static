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
    ['./static/site2', '/root'],
    ['./static/_common/common.html', '/root'],
    ['./static/_blob/*.svg', '/root'],
    ['./static/_blob/**/*.{ico,png}', '/root'],
    // ['./static/_blob/folder/*.{ico,png}', '/root'],
  ],

  // mappingDevLocationRewrite(location) {
  //   return location.replace(/^\/root/, '/root-dev');
  // },
  //
  // mappingBuildLocationRewrite(location) {
  //   return location.replace(/^\/root/, '/root-build');
  // },
};
