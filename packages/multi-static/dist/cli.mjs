import cac from 'cac';

const cli = cac('multi-static');
cli
  .command('dev', 'Run dev server')
  .option('-p, --port', 'Server port')
  .action((options) => {
    console.log('++++', options);
  });
cli.help();
cli.parse();
//# sourceMappingURL=cli.mjs.map
