import localhostCerts from 'localhost-certs';
import { defineConfig } from 'multi-static';
import { esbuildBundleTransformer } from './transformers/esbuild-bundle';

export default defineConfig({
  mapping: [['./static', '/']],
  http: {
    port: 3020,
    ...localhostCerts(),
  },
  transformers: [esbuildBundleTransformer],
});
