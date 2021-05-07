const commonConfig = require('./common.config');

module.exports = {
  ...commonConfig,

  mapping: [
    ['./static/folder2', '/root'],
    ['./static/_common', '/root'],
  ],

  internalParams: {
    foo: 'azz11'
  },

  welcomeMessage: 'hello from folder2.config',
};
