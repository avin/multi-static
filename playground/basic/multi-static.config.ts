import fs from 'fs';
import { defineConfig } from 'multi-static';
import sass from 'sass';

const config = defineConfig({
  mapping: [['./static', '/']],

  devTransformers: [
    {
      test: /\.html$/,
      processors: [
        ({ content }) => {
          return content.replace(/world/g, 'TRANSED');
        },
        ({ content }) => {
          return content.replace(/TRANSED/g, 'MORE_TRANSED');
        },
      ],
    },
    {
      test: /\.css$/,
      reader: ({ filePath, ctx }) => {
        const sassFilePath = filePath.replace(/\.css$/, '.scss');
        if (!fs.existsSync(sassFilePath)) {
          return null;
        }
        ctx.sassFilePath = sassFilePath;
        return true;
      },
      processors: [
        ({ content, filePath, ctx }) => {
          const { sassFilePath } = ctx;
          const sassResult = sass.compile(sassFilePath as string, {
            loadPaths: [process.cwd()],
          });
          return sassResult.css;
        },
      ],
    },
  ],

  // buildTransformers: [
  //   {
  //     test: /\.scss?$/,
  //     reader: ({ destinationPath, filePath, ctx }) => {},
  //     processors: [
  //       ({ content, destinationPath, filePath, ctx }) => {
  //         // транформируем content
  //       },
  //     ],
  //     writer: ({ content, destinationPath, filePath, ctx }) => {
  //       // записываем файл
  //     },
  //   },
  // ],
});

export default config;
