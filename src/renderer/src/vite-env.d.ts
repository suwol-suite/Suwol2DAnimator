/// <reference types="vite/client" />

import type { HydratedProjectResult, ImportedImage, Suwol2DAtlasExportOptions, Suwol2DProjectFile } from '../../shared/suwol2d-format';
import type { AppSettings, UpdateSettings } from '../../shared/app-settings';
import type { LocaleCode } from '../../shared/i18n/types';
import type { UpdateCheckResult, UpdateDownloadResult, UpdateInstallResult } from '../../shared/update/update-types';

export interface ExportJsonResult {
  exportPath: string;
  texturePaths: string[];
  atlasPaths: string[];
}

export interface ExportSuwol2DAssetResult {
  exportPath: string;
  debugJsonPath: string;
  texturePaths: string[];
  atlasPaths: string[];
}

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';
export type AppMenuCommand = 'newProject' | 'openProject' | 'saveProject' | 'exportProject' | 'quit' | 'undo' | 'redo';

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
    exportSuwol2DJson(projectFilePath: string, project: Suwol2DProjectFile, options: Suwol2DAtlasExportOptions): Promise<ExportJsonResult | null>;
    exportSuwol2DAsset(projectFilePath: string, project: Suwol2DProjectFile, options: Suwol2DAtlasExportOptions): Promise<ExportSuwol2DAssetResult | null>;
    createBackup(projectFilePath: string, project: Suwol2DProjectFile): Promise<string>;
  };
  app: {
    getAppSettings(): Promise<AppSettings>;
    saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
    confirmUnsavedChanges(projectName: string, locale?: LocaleCode): Promise<UnsavedChangesChoice>;
    forceClose(): Promise<void>;
    onMenuCommand(callback: (command: AppMenuCommand) => void): () => void;
    onCloseRequest(callback: () => void): () => void;
  };
  update: {
    checkForUpdates(): Promise<UpdateCheckResult>;
    downloadUpdate(): Promise<UpdateDownloadResult>;
    installUpdateAndRestart(): Promise<UpdateInstallResult>;
    openDownloadedUpdateFolder(): Promise<UpdateDownloadResult>;
    getUpdateSettings(): Promise<UpdateSettings>;
    saveUpdateSettings(settings: Partial<UpdateSettings>): Promise<UpdateSettings>;
  };
}

declare global {
  interface Window {
    suwol: SuwolPreloadApi;
  }
}
