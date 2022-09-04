import { Express, Request, Response, NextFunction } from 'express';

export interface MultiStaticConfig {
  /** Настройки web-сервера в dev режиме */
  http: {
    port?: number;
    key?: string;
    cert?: string;
  };

  /** Выходная папка для билда */
  buildPath: string;

  /** Маппинг исходных файлов с тем как они должны быть расположены при сборке*/
  mapping: [string, string][];

  /** Функция обработки файла в dev-режиме */
  fileDevProcessing: ({
    fileSrc,
    req,
    res,
    next,
  }: {
    fileSrc: string;
    req: Request;
    res: Response;
    next: NextFunction;
  }) => Promise<boolean> | boolean;

  /** Функция обработки файла в build-режиме */
  fileBuildProcessing: (...args: any) => Promise<void> | void;

  /** ?? */
  mappingDevLocationRewrite: (dst: string) => string;

  /** ?? */
  mappingBuildLocationRewrite: (dst: string) => string;

  /** Функция вызываемая до сборки */
  beforeBuild: () => Promise<void> | void;

  /** Функция вызываемая после сборки */
  afterBuild: () => Promise<void> | void;

  /** Функция вызываемая до запуска web-сервера в dev режиме */
  beforeDevStart: (app?: Express) => Promise<void> | void;

  /** Дополнительные опции (могут использоваться обработчиками файлов) */
  customOptions: Record<string, unknown>;

  /** Имя файла с дополнительными опциями.
   * Опции будут применимы ко всем файлам внутри этого каталога и к вложенным */
  optionsFileName: string;
}
