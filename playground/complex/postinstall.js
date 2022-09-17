const npmInstallSubfolders = require('npm-install-subfolders');
const path = require('path');

npmInstallSubfolders({
  rootFolder: path.resolve(__dirname, 'static'),
  verbose: true,
  client: 'yarn',
});
