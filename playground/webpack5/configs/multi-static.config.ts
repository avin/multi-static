import localhostCerts from 'localhost-certs';
import { defineConfig } from 'multi-static';
import { webpackBundleTransformer } from './transformers/webpack-bundle';

export default defineConfig({
  mapping: [['./static', '/']],
  http: {
    port: 3040,
    ...localhostCerts(),
  },
  transformers: [webpackBundleTransformer],
});
