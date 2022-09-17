import { defineConfig, makeTest, defaultFileReader } from 'multi-static';
import localhostCerts from 'localhost-certs';
import sass from 'sass';
import fs from 'fs-extra';

const config = defineConfig({
  mapping: [['./static', '/']],

  http: {
    ...localhostCerts(),
  },

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
      beforeTest: ({ file }) => {
        file.servePath = file.servePath.replace(/\.scss$/, '.css');
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

  onBeforeBuild({ config }) {
    console.info(`+ removing ${config.buildPath}`);
    fs.removeSync(this.buildPath as string);
  },
});

export default config;
