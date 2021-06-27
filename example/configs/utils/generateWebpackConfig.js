const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

function generateWebpackConfig({
  src = '',
  filename,
  path,
  publicPath,
  mode = 'development',
  useProductionSourceMap = false,
} = {}) {
  const isEnvDevelopment = mode === 'development';
  const isEnvProduction = mode === 'production';

  const config = {
    mode,
    entry: {
      app: src,
    },
    devtool: (() => {
      if (isEnvDevelopment) {
        return 'inline-cheap-source-map';
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
    performance: false,
    resolve: {
      alias: {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|mjs|jsx|ts|tsx)$/,
          exclude: [/node_modules/],
          loader: require.resolve('babel-loader'),
          options: {
            cacheDirectory: true,
            cacheCompression: false,
            compact: isEnvProduction,

            presets: [['@babel/preset-env'], ['@babel/preset-react'], ['@babel/preset-typescript']],
            plugins: [
              ['@babel/transform-runtime'],
              ['@babel/plugin-proposal-class-properties'],
            ],
          },
        },
      ],
    },

    optimization: {
      minimize: isEnvProduction,
      usedExports: isEnvProduction,
      minimizer: [
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
          parallel: false,
          cache: true,
          sourceMap: useProductionSourceMap,
          extractComments: false,
        }),
      ],
    },

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

  console.log(JSON.stringify(config, null, 2));

  return config;
}

module.exports = generateWebpackConfig;
