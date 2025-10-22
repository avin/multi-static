import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'static'),
  base: '/',
  publicDir: false,
  build: {
    sourcemap: true,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'static/assets/main.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
