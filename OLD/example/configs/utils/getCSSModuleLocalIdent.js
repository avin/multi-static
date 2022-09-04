const path = require('path');
const loaderUtils = require('loader-utils');
const fs = require('fs');

const getCSSModuleLocalIdent = (context, localIdentName, localName, options) => {
  const fileNameOrFolder = context.resourcePath.match(/index\.module\.(css|scss|sass)$/)
    ? '[folder]'
    : '[name]';

  const hash = loaderUtils.getHashDigest(
    path.posix.relative(context.rootContext, context.resourcePath) + localName,
    'md5',
    'base64',
    8
  );

  const className = loaderUtils.interpolateName(
    context,
    fileNameOrFolder + '_' + localName + '__' + hash,
    options
  );

  return className.replace('.module_', '_').replace(/\./g, '_');
};

module.exports = getCSSModuleLocalIdent;
