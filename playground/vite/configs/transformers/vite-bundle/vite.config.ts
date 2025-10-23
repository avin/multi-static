import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../../static'),
  base: '/',
  publicDir: false,
  build: {
    sourcemap: true,
    emptyOutDir: false,
  },
});
