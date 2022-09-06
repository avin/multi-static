import fs from 'fs';
import { defineConfig, Processor } from 'multi-static';
import sass from 'sass';

const htmlProcessors: Processor[] = [
  ({ content }: { content: string }) => {
    return content.replace(/world/g, 'TRANSED');
  },
  ({ content }: { content: string }) => {
    return content.replace(/TRANSED/g, 'MORE_TRANSED');
  },
];

const scssProcessors: Processor[] = [
  ({ content, file, ctx }) => {
    const sassResult = sass.compile(file.srcPath, {
      loadPaths: [process.cwd()],
    });
    return sassResult.css;
  },
];

const config = defineConfig({
  mapping: [['./static', '/']],

  devTransformers: [
    {
      test: /\.html$/,
      processors: htmlProcessors,
    },
    {
      test: /\.css$/,
      reader: ({ file, ctx }) => {
        const sassFilePath = file.srcPath.replace(/\.css$/, '.scss');
        if (!fs.existsSync(sassFilePath)) {
          return null;
        }
        file.srcPath = sassFilePath;
        return true;
      },
      processors: scssProcessors,
    },
  ],

  buildTransformers: [
    {
      test: /\.html$/,
      processors: htmlProcessors,
    },
    {
      test: /\.scss$/,
      reader: ({ file, ctx }) => {
        file.dstPath = file.srcPath.replace(/\.scss$/, '.css');
        return true;
      },
      processors: scssProcessors,
    },
  ],
});

export default config;
