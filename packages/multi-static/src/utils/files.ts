import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';

export const getFilesList = (
  dir: string,
  pathList: string[] = [],
  options: { exclude?: (fileName: string) => boolean } = {},
) => {
  if (fs.pathExistsSync(dir)) {
    fs.readdirSync(dir)
      .filter((file) => {
        if (options.exclude) {
          if (options.exclude(file)) {
            return false;
          }
        }
        return true;
      })
      .forEach((file) => {
        const absolute = path.join(dir, file);

        if (fs.statSync(absolute).isDirectory()) {
          return getFilesList(absolute, pathList, options);
        } else {
          return pathList.push(absolute);
        }
      });
  }

  return pathList;
};

export const getGlobBasePath = (globString: string, pathSep = path.sep) => {
  const globParts = globString.split(pathSep);

  let magicIndex = 0;
  for (let i = 0; i < globParts.length; i += 1) {
    if (glob.hasMagic(globParts[i])) {
      magicIndex = i;
      break;
    }
  }

  const result: string = globParts.splice(0, magicIndex).join(pathSep);
  return result;
};

export const pathBelongsTo = (oPath: string, cPath: string) => {
  const oPathParts = oPath.split('/');
  const cPathParts = cPath.split('/');

  let result = true;

  for (let i = 0; i < cPathParts.length; i++) {
    result = result && cPathParts[i] === oPathParts[i];
  }
  return result;
};
