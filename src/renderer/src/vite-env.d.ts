/// <reference types="vite/client" />

import type { HydratedProjectResult, ImportedImage, Suwol2DProjectFile } from '../../shared/suwol2d-format';
import type { AppSettings } from '../../shared/app-settings';
import type { LocaleCode } from '../../shared/i18n/types';

export interface ExportJsonResult {
  exportPath: string;
  texturePaths: string[];
}

export interface ExportSuwol2DAssetResult {
  exportPath: string;
  debugJsonPath: string;
  texturePaths: string[];
}

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

export interface SuwolPreloadApi {
  appKind: 'electron-editor';
  platform: NodeJS.Platform;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
  project: {
    createProject(name: string): Promise<HydratedProjectResult | null>;
    openProject(): Promise<HydratedProjectResult | null>;
    saveProject(projectFilePath: string, project: Suwol2DProjectFile): Promise<HydratedProjectResult>;
    importImage(projectFilePath: string): Promise<ImportedImage | null>;
    createSampleAssets(projectFilePath: string): Promise<ImportedImage[]>;
    createSkinSampleAssets(projectFilePath: string): Promise<ImportedImage[]>;
    createAnimationTimelinesSampleAssets(projectFilePath: string): Promise<ImportedImage[]>;
    exportSuwol2DJson(projectFilePath: string, project: Suwol2DProjectFile): Promise<ExportJsonResult | null>;
    exportSuwol2DAsset(projectFilePath: string, project: Suwol2DProjectFile): Promise<ExportSuwol2DAssetResult | null>;
    createBackup(projectFilePath: string, project: Suwol2DProjectFile): Promise<string>;
  };
  app: {
    getAppSettings(): Promise<AppSettings>;
    saveAppSettings(settings: AppSettings): Promise<AppSettings>;
    confirmUnsavedChanges(projectName: string, locale?: LocaleCode): Promise<UnsavedChangesChoice>;
    forceClose(): Promise<void>;
    onCloseRequest(callback: () => void): () => void;
  };
}

declare global {
  interface Window {
    suwol: SuwolPreloadApi;
  }
}
