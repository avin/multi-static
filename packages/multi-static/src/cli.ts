import cac from 'cac';

const cli = cac('multi-static');

cli
  .command('dev', 'Run dev server')
  .option('-p, --port <port>', 'Server port')
  .action((options) => {
    console.log('++++', options);
  });

cli.help();

cli.parse();
