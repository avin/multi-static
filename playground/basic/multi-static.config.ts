import { defineConfig } from 'multi-static';

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
  ],

  buildTransformers: [
    {
      test: /\.scss?$/,
      reader: ({ destinationPath, filePath, ctx }) => {},
      processors: [
        ({ content, destinationPath, filePath, ctx }) => {
          // транформируем content
        },
      ],
      writer: ({ content, destinationPath, filePath, ctx }) => {
        // записываем файл
      },
    },
  ],
});

export default config;
