import cac from 'cac';
import { startServer } from './server';
import { defaultConfig, readConfig } from './utils';
import { build } from './builder';

const cli = cac('multi-static');

cli
  .command('dev', 'Run dev server')
  .option('-c, --config <config>', 'Config')
  .option('-p, --port <port>', 'Server port', {
    default: defaultConfig.http.port,
  })
  .action(async (options: { config: string | undefined; port: number }) => {
    const config = {
      ...(await readConfig(options.config)),
      http: {
        ...defaultConfig.http,
        port: options.port,
      },
    };
    await startServer(config);
  });

cli
  .command('build', 'Build')
  .option('-c, --config <config>', 'Config')
  .action(async (options: { config: string }) => {
    const config = {
      ...(await readConfig(options.config)),
    };
    await build(config);
  });

cli.help();

cli.parse();
