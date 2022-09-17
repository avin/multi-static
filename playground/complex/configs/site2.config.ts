import { defineConfig } from 'multi-static';
import commonConfig from './common.config';

export default defineConfig({
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
    ['./static/_common', '/root'],
    // ['./static/_common/common.html', '/root'],
    // ['./static/_globs/*.svg', '/root'],
    // ['./static/_globs/**/*.{ico,png}', '/root'],
    // ['./static/_globs/folder/*.{ico,png}', '/root'],
  ],

  // mappingDevLocationRewrite(location) {
  //   return location.replace(/^\/root/, '/root-dev');
  // },
  //
  // mappingBuildLocationRewrite(location) {
  //   return location.replace(/^\/root/, '/root-build');
  // },
});
