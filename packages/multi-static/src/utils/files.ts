import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';

export const getFilesList = (dir: string, pathList: string[] = []) => {
  if (fs.pathExistsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const absolute = path.join(dir, file);
      if (fs.statSync(absolute).isDirectory()) {
        return getFilesList(absolute, pathList);
      } else return pathList.push(absolute);
    });
  }

  return pathList;
};

export const getGlobBasePath = (globString: string, pathSep = '/') => {
  const globParts = globString.split(pathSep);

  let magicIndex = 0;
  for (let i = 0; i < globParts.length; i += 1) {
    if (glob.hasMagic(globParts[i])) {
      magicIndex = i;
      break;
    }
  }

  const result: string = globParts.splice(0, magicIndex).join('/');
  return result;
};
