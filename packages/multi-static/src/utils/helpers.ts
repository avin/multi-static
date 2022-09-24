const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);

export const escapeRegExp = (string: string) => {
  return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, '\\$&') : string || '';
};

export const hasUnderscoreAtFileNameStart = (filePath: string) => {
  const parts = filePath.split(/[\\/]/);
  for (const part of parts) {
    if (/^_/.test(part)) {
      return true;
    }
  }
  return false;
};

export const relativePath = (filePath: string, replacingPath = process.cwd()) =>
  filePath.replace(new RegExp(`^${escapeRegExp(replacingPath)}`), '');

export const uniPathSep = (filePath: string, pathSep = '/') => {
  return filePath.replace(/[\\/]/g, '/');
};
