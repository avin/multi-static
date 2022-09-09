import { defineConfig, makeTest, defaultFileReader } from 'multi-static';
import localhostCerts from 'localhost-certs';
import sass from 'sass';
import fs from 'fs-extra';

const config = defineConfig({
  mapping: [['./static', '/']],

  http: {
    ...localhostCerts(),
  },

  exclude: ({ file }) => file.dstPath.includes('favicon.ico'),

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

  beforeBuild() {
    console.info(`+ removing ${this.buildPath}`);
    fs.removeSync(this.buildPath as string);
  },
});

export default config;
