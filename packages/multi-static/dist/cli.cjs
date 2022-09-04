'use strict';

var cac = require('cac');

function _interopDefaultLegacy(e) {
  return e && typeof e === 'object' && 'default' in e ? e : { default: e };
}

var cac__default = /*#__PURE__*/ _interopDefaultLegacy(cac);

const cli = cac__default['default']('multi-static');
cli
  .command('dev', 'Run dev server')
  .option('-p, --port', 'Server port')
  .action((options) => {
    console.log('++++', options);
  });
cli.help();
cli.parse();
//# sourceMappingURL=cli.cjs.map
