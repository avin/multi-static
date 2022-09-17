import { Express, Response, Request, NextFunction } from 'express';
import https from 'https';
import http from 'http';

export type MaybePromise<T> = T | Promise<T>;

export interface File {
  srcPath: string;
  servePath: string;
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
    buildPath: string;
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
  beforeTest?: BeforeTestFunc;
  test: FileTestFunc;
  processors: Processor[];
  sendResponse: SendResponseFunc;
  writeContent: WriteContentFunc;
}

export interface MultiStaticConfig {
  /** Web server settings (dev-mode server) */
  http: {
    port?: number;
    key?: string;
    cert?: string;
  };

  /** The path where the build files will be placed */
  buildPath: string;

  /** Mapping the source files (srcPath) with how they should be located when building (servePath) */
  mapping: [string, string][];

  /** Rewrite serve location in dev mode */
  rewriteServeLocationInDevMode: (servLocation: string) => string;

  /** Rewrite serve location in build mode */
  rewriteServeLocationInBuildMode: (servLocation: string) => string;

  /** Функция вызываемая до сборки */
  onBeforeBuild?: (params: { config: MultiStaticConfig }) => Promise<void> | void;

  /** Функция вызываемая после сборки */
  onAfterBuild?: (params: { config: MultiStaticConfig }) => Promise<void> | void;

  /** Run before setup Express App middlewares */
  onBeforeSetupMiddleware?: (params: { app: Express; config: MultiStaticConfig }) => MaybePromise<void>;

  /** Run after setup Express App middlewares */
  onAfterSetupMiddleware?: (params: { app: Express; config: MultiStaticConfig }) => MaybePromise<void>;

  /** Run when server starts listening for connections */
  onListening?: (params?: {
    app: Express;
    server: https.Server | http.Server;
    config: MultiStaticConfig;
  }) => MaybePromise<void>;

  /** Additional options (can be used by file transformers) */
  customOptions: CustomOptions;

  /** File name with custom options.
   * The options will apply to all file transformers for files within this directory and to subfolders */
  customOptionsFileName: string;

  /** Transformers */
  transformers: Partial<Transformer>[];
}
