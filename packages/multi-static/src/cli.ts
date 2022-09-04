import cac from 'cac';
import { startServer } from './server';
import { defaultConfig, readConfig } from './utils';

const cli = cac('multi-static');

cli
  .command('dev', 'Run dev server')
  .option('-c, --config <config>', 'Config', {
    default: 'multi-static.config.js',
  })
  .option('-p, --port <port>', 'Server port', {
    default: defaultConfig.http.port,
  })
  .action((options) => {
    const config = {
      ...readConfig(options.config),
      http: {
        ...defaultConfig.http,
        port: options.port,
      },
    };
    // const config = {
    //   ...defaultConfig,
    //   http: {
    //     ...defaultConfig.http,
    //     port: options.port,
    //   },
    // };
    startServer(config);
  });

cli.help();

cli.parse();
