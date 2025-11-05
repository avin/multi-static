import localhostCerts from 'localhost-certs';
import { defineConfig } from 'multi-static';
import { rspackBundleTransformer } from './transformers/rspack-bundle';

export default defineConfig({
  mapping: [['./static', '/']],
  http: {
    port: 3050,
    ...localhostCerts(),
  },
  transformers: [rspackBundleTransformer],
});
