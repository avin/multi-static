# Multi-static monorepo

```js
// Transformer

{
  devTransformers: [
    {
      test: /\.css?$/,
      reader: ({ reqPath, filePath, ctx }) => {
        // Если удалось прочитать
        return '<content>';
        // Если не удалось прочитать
        return null;
      },
      processors: [
        ({ content, reqPath, filePath, ctx }) => {
          // транcформируем content
          return '<trans_content>';
        },
      ],
      response: ({ content, reqPath, filePath, ctx }) => {
        res.setHeader('Content-Type', 'text/css');
        res.send(content);
      },
    },
  ];

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
  ];
}
```
