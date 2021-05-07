const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

function generateWebpackConfig({ src = '', filename, path, publicPath, mode = 'development' } = {}) {

  const isEnvDevelopment = mode === 'development';
  const isEnvProduction = mode === 'production';

  const useProductionSourceMap = false;

  // const dstArr = dst.split('/');
  //
  // let dstFileName = dstArr.slice(-1)[0];
  // const dstPath = dstArr.slice(0, -1).join('/');

  const config = {
    mode,
    entry: {
      // Путь входого файла
      app: src,
    },
    devtool: (() => {
      if (isEnvDevelopment) {
        return 'cheap-module-source-map';
      } else if (isEnvProduction) {
        return useProductionSourceMap ? 'source-map' : false;
      }
      return false;
    })(),
    output: {
      filename,
      path,
      publicPath,
    },
    plugins: [],
    // Не ругаться на размер выходного файла
    performance: false,
    module: {
      rules: [
        {
          test: /\.(js|mjs|jsx)$/,
          exclude: [/node_modules/],
          loader: require.resolve('babel-loader'),
          options: {
            // Для более быстрых ребилдов
            cacheDirectory: true,
            cacheCompression: false,
            compact: isEnvProduction,
          },
        },
      ],
    },

    optimization: {
      minimize: isEnvProduction,
      usedExports: isEnvProduction,
      minimizer: [
        // Сжималка JS - все настройки выставлены для нормальной совместимости со старыми браузерами
        new TerserPlugin({
          terserOptions: {
            parse: {
              ecma: 8,
            },
            compress: {
              ecma: 5,
              warnings: false,
              comparisons: false,
              inline: 2,
            },
            mangle: {
              safari10: true,
            },
            output: {
              ecma: 5,
              comments: false,
              ascii_only: true,
            },
          },
          // Паралельность может валиться в некоторых системах (например wsl)
          parallel: false,
          cache: true,
          sourceMap: useProductionSourceMap,
          extractComments: false,
        }),
      ],
    },

    // Некоторых либы пытаются тянуть node-овские модули, не дадим им это сделать
    node: {
      module: 'empty',
      dgram: 'empty',
      dns: 'mock',
      fs: 'empty',
      http2: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
  };

  return config;
}

module.exports = generateWebpackConfig;
