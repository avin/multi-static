const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  mapping: [
    ['./static/site2', '/root'],
    ['./static/_common', '/root'],
  ],

  // mappingDevLocationRewrite(location) {
  //   return location.replace(/^\/root/, '/root-dev');
  // },
  //
  // mappingBuildLocationRewrite(location) {
  //   return location.replace(/^\/root/, '/root-build');
  // },
};