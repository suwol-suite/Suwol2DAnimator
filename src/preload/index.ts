import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('suwol', {
  appKind: 'electron-editor',
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  project: {
    createProject: (name: string) => ipcRenderer.invoke('project:create', name),
    openProject: () => ipcRenderer.invoke('project:open'),
    saveProject: (projectFilePath: string, project: unknown) =>
      ipcRenderer.invoke('project:save', projectFilePath, project),
    importImage: (projectFilePath: string) => ipcRenderer.invoke('project:import-image', projectFilePath),
    createSampleAssets: (projectFilePath: string) => ipcRenderer.invoke('project:create-sample-assets', projectFilePath),
    createSkinSampleAssets: (projectFilePath: string) => ipcRenderer.invoke('project:create-skin-sample-assets', projectFilePath),
    createAnimationTimelinesSampleAssets: (projectFilePath: string) =>
      ipcRenderer.invoke('project:create-animation-timelines-sample-assets', projectFilePath),
    exportSuwol2DJson: (projectFilePath: string, project: unknown, options: unknown) =>
      ipcRenderer.invoke('project:export-json', projectFilePath, project, options),
    exportSuwol2DAsset: (projectFilePath: string, project: unknown, options: unknown) =>
      ipcRenderer.invoke('project:export-suwol2d', projectFilePath, project, options),
    createBackup: (projectFilePath: string, project: unknown) =>
      ipcRenderer.invoke('project:create-backup', projectFilePath, project)
  },
  app: {
    getAppSettings: () => ipcRenderer.invoke('app:get-settings'),
    saveAppSettings: (settings: unknown) => ipcRenderer.invoke('app:save-settings', settings),
    confirmUnsavedChanges: (projectName: string, locale?: string) => ipcRenderer.invoke('app:confirm-unsaved-changes', projectName, locale),
    forceClose: () => ipcRenderer.invoke('app:force-close'),
    onMenuCommand: (callback: (command: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: string) => callback(command);
      ipcRenderer.on('app:menu-command', listener);
      return () => ipcRenderer.removeListener('app:menu-command', listener);
    },
    onCloseRequest: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('app:request-close', listener);
      return () => ipcRenderer.removeListener('app:request-close', listener);
    }
  },
  update: {
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    installUpdateAndRestart: () => ipcRenderer.invoke('update:install-and-restart'),
    openDownloadedUpdateFolder: () => ipcRenderer.invoke('update:open-download-folder'),
    getUpdateSettings: () => ipcRenderer.invoke('update:get-settings'),
    saveUpdateSettings: (settings: unknown) => ipcRenderer.invoke('update:save-settings', settings)
  }
});
