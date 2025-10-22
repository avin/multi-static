import localhostCerts from 'localhost-certs';
import { defineConfig } from 'multi-static';
import { rollupBundleTransformer } from './transformers/rollup-bundle';

export default defineConfig({
  mapping: [['./static', '/']],
  http: {
    port: 3030,
    ...localhostCerts(),
  },
  transformers: [rollupBundleTransformer],
});
