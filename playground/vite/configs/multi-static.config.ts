import localhostCerts from 'localhost-certs';
import { defineConfig } from 'multi-static';
import { viteBundleTransformer } from './transformers/vite-bundle';

export default defineConfig({
  mapping: [['./static', '/']],
  http: {
    port: 3010,
    ...localhostCerts(),
  },
  transformers: [viteBundleTransformer],
});
