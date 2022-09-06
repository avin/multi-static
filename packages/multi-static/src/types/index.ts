import { Express, Response } from 'express';

export interface File {
  srcPath: string;
  dstPath: string;
}

export type TransformerMode = 'dev' | 'build';

export type Processor = (params: {
  content: any;
  file: File;
  mode: TransformerMode;
  ctx: Record<string, unknown>;
}) => Promise<string> | string;

export type Reader = (params: {
  file: File;
  mode: TransformerMode;
  ctx: Record<string, unknown>;
}) => Promise<any | null> | any | null;

export type Writer = (params: {
  content: any;
  file: File;
  mode: TransformerMode;
  ctx: Record<string, unknown>;
}) => Promise<void> | void;

export type ResponseMaker = (params: {
  content: any;
  file: File;
  res: Response;
  mode: TransformerMode;
  ctx: Record<string, unknown>;
}) => Promise<void> | void;

export interface DevTransformer {
  test: RegExp;
  reader: Reader;
  processors: Processor[];
  responseMaker: ResponseMaker;
}

export interface BuildTransformer {
  test: RegExp;
  reader: Reader;
  processors: Processor[];
  writer: Writer;
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

  /** Трансформеры для dev-режима */
  devTransformers: Partial<DevTransformer>[];

  /** Трансформеры для build-режима */
  buildTransformers: Partial<BuildTransformer>[];
}
