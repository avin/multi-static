import fs from 'fs';
import { defineConfig } from 'multi-static';
import sass from 'sass';

const config = defineConfig({
  mapping: [['./static', '/']],

  devTransformers: [
    {
      test: /\.html$/,
      processors: [
        ({ content }: { content: string }) => {
          return content.replace(/world/g, 'TRANSED');
        },
        ({ content }: { content: string }) => {
          return content.replace(/TRANSED/g, 'MORE_TRANSED');
        },
      ],
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
      processors: [
        ({ content, file, ctx }) => {
          const sassResult = sass.compile(file.srcPath, {
            loadPaths: [process.cwd()],
          });
          return sassResult.css;
        },
      ],
    },
  ],

  buildTransformers: [
    {
      test: /\.html$/,
      processors: [
        ({ content }: { content: string }) => {
          return content.replace(/world/g, 'TRANSED');
        },
        ({ content }: { content: string }) => {
          return content.replace(/TRANSED/g, 'MORE_TRANSED');
        },
      ],
    },
    {
      test: /\.scss$/,
      reader: ({ file, ctx }) => {
        file.dstPath = file.srcPath.replace(/\.scss$/, '.css');
        return true;
      },
      processors: [
        ({ content, file, ctx }) => {
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
