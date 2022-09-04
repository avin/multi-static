import { Express } from 'express';

export interface Config {
  http: {
    port?: number;
    key?: string;
    cert?: string;
  };
  buildPath: string;
  mapping: [string, string][];
  fileDevProcessing: (...args: any) => void;
  fileBuildProcessing: (...args: any) => void;
  mappingDevLocationRewrite: (dst: string) => string;
  mappingBuildLocationRewrite: (dst: string) => string;
  beforeBuild: () => void;
  afterBuild: () => void;
  beforeDevStart: (app?: Express) => void;
  customOptions: Record<string, unknown>;
  optionsFileName: string;

  // [k: string]: any;
}
