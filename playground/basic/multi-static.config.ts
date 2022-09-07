import { defineConfig, makeTest, defaultFileReader } from 'multi-static';
import sass from 'sass';

const config = defineConfig({
  mapping: [['./static', '/']],

  transformers: [
    {
      test: makeTest({
        check: ({ file }) => file.srcPath.endsWith('.html'),
      }),
      processors: [
        defaultFileReader,
        ({ content }) => {
          return (content as string).replace(/world/g, 'TRANSED');
        },
        ({ content }) => {
          return (content as string).replace(/TRANSED/g, 'MORE_TRANSED');
        },
      ],
    },
    {
      beforeTest: ({ file, mode }) => {
        file.dstPath = file.dstPath.replace(/\.scss$/, '.css');
        file.srcPath = file.srcPath.replace(/\.css$/, '.scss');
      },
      test: makeTest({
        check: ({ file }) => file.srcPath.endsWith('.scss'),
        checkFirstLine: (firstLine) => firstLine.startsWith('// @process'),
      }),
      processors: [
        ({ file }) => {
          const sassResult = sass.compile(file.srcPath, {
            loadPaths: [process.cwd()],
          });
          return sassResult.css;
        },
      ],
    },
  ],
});

export default config;
