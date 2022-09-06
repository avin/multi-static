import { Express, Request, Response, NextFunction } from 'express';

// export type DevTransformer = {
//   test?: RegExp;
//   reader: (params: { reqPath: string; filePath: string; ctx: TContext }) => Promise<string | null> | string | null;
//   processors?: ((params: { content: TContent; reqPath: string; filePath: string; ctx: TContext }) => TContent)[];
//   makeResponse: (params: {
//     content: TContent;
//     reqPath: string;
//     filePath: string;
//     res: Response;
//     ctx: TContext;
//   }) => Promise<void> | void;
// };

export interface File {
  srcPath: string;
  dstPath: string;
}

export type Processor = (params: {
  content: any;
  file: File;
  ctx: Record<string, unknown>;
}) => Promise<string> | string;

export interface DevTransformer {
  test: RegExp;
  reader: (params: { file: File; ctx: Record<string, unknown> }) => Promise<any | null> | any | null;
  processors: Processor[];
  makeResponse: (params: {
    content: any;
    file: File;
    res: Response;
    ctx: Record<string, unknown>;
  }) => Promise<void> | void;
}

export interface BuildTransformer {
  test: RegExp;
  reader: (params: { file: File; ctx: Record<string, unknown> }) => Promise<any | null> | any | null;
  processors: Processor[];
  writer: (params: { content: any; file: File; ctx: Record<string, unknown> }) => Promise<void> | void;
}

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

  /** ?? */
  mappingDevLocationRewrite: (dst: string) => string;

  /** ?? */
  mappingBuildLocationRewrite: (dst: string) => string;

  /** Функция вызываемая до сборки */
  beforeBuild: () => Promise<void> | void;

  /** Функция вызываемая после сборки */
  afterBuild: () => Promise<void> | void;

  /** Функция вызываемая до запуска web-сервера в dev режиме */
  beforeDevStart: (params: { app?: Express }) => Promise<void> | void;

  /** Дополнительные опции (могут использоваться обработчиками файлов) */
  customOptions: Record<string, unknown>;

  /** Имя файла с дополнительными опциями.
   * Опции будут применимы ко всем файлам внутри этого каталога и к вложенным */
  optionsFileName: string;

  // TODO
  devTransformers: Partial<DevTransformer>[];

  // TODO
  buildTransformers: Partial<BuildTransformer>[];
}
