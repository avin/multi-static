import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';

const bundle = (lib, config) => ({
  ...config,
  input: `src/${lib}.ts`,
  external: [/node_modules/],
});

const result: any[] = [];
for (const lib of ['main', 'cli']) {
  result.push(
    bundle(lib, {
      plugins: [resolve(), esbuild()],
      output: [
        {
          file: `${lib}.cjs`,
          format: 'cjs',
          sourcemap: true,
        },
        {
          file: `${lib}.mjs`,
          format: 'es',
          sourcemap: true,
        },
      ],
    }),
  );
  result.push(
    bundle(lib, {
      plugins: [dts()],
      output: {
        file: `${lib}.d.ts`,
        format: 'es',
      },
    }),
  );
}

export default result;
