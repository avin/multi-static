import { Express, Response, Request, NextFunction } from 'express';

export type MaybePromise<T> = T | Promise<T>;

export interface File {
  srcPath: string;
  dstPath: string;
}

export type Ctx = Record<string, any>;

export type CustomOptions = Record<string, any>;

export type TransformerMode = 'dev' | 'build';

type CommonParams = {
  file: File;
  mode: TransformerMode;
  ctx: Ctx;
  customOptions: CustomOptions;
};

export type Processor = (params: { content: any } & CommonParams) => Promise<any> | any;

export type WriteContentFunc = (
  params: {
    content: any;
  } & CommonParams,
) => MaybePromise<void>;

export type SendResponseFunc = (
  params: {
    content: any;
    res: Response;
    req: Request;
    next: NextFunction;
  } & CommonParams,
) => MaybePromise<void>;

export type FileTestFunc = (params: CommonParams) => MaybePromise<boolean>;

export type BeforeTestFunc = (params: CommonParams) => MaybePromise<void>;

export interface Transformer {
  // test: RegExp;
  // reader: Reader;
  beforeTest?: BeforeTestFunc;
  test: FileTestFunc;
  processors: Processor[];
  sendResponse: SendResponseFunc;
  writeContent: WriteContentFunc;
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
  beforeDevStart: (params: { app?: Express }) => MaybePromise<void>;

  /** Дополнительные опции (могут использоваться обработчиками файлов) */
  customOptions: CustomOptions;

  /** Имя файла с дополнительными опциями.
   * Опции будут применимы ко всем файлам внутри этого каталога и к вложенным */
  optionsFileName: string;

  /** Трансформеры для dev-режима */
  transformers: Partial<Transformer>[];

  exclude?: (dstPath: string) => MaybePromise<boolean>;
}

export interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any;
}
