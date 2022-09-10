import cac from 'cac';
import { startServer } from './server';
import { build } from './builder';
import defu from 'defu';
import { defaultConfig, readConfig } from './config';

const cli = cac('multi-static');

cli
  .command('dev', 'Run dev server')
  .option('-c, --config <config>', 'Config')
  .option('-p, --port <port>', 'Server port', {
    default: defaultConfig.http.port,
  })
  .action(async (options: { config: string | undefined; port: number }) => {
    const config = defu({ http: { port: options.port } }, await readConfig(options.config));

    await startServer(config);
  });

cli
  .command('build', 'Build')
  .option('-c, --config <config>', 'Config')
  .action(async (options: { config: string }) => {
    const config = defu({}, await readConfig(options.config));

    await build(config);
  });

cli.help();

cli.parse();
