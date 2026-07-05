import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import type { LocaleCode } from '../shared/i18n/types';
import { createTranslator } from '../shared/i18n/translate';

export type AppMenuCommand = 'newProject' | 'openProject' | 'saveProject' | 'exportProject' | 'quit' | 'undo' | 'redo';

type MenuLabels = {
  file: string;
  newProject: string;
  openProject: string;
  saveProject: string;
  exportProject: string;
  quit: string;
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  delete: string;
  selectAll: string;
  view: string;
  reload: string;
  forceReload: string;
  toggleDevTools: string;
  actualSize: string;
  zoomIn: string;
  zoomOut: string;
  toggleFullScreen: string;
  window: string;
  minimize: string;
  close: string;
};

export function configureApplicationMenu(locale: LocaleCode): void {
  const labels = getMenuLabels(locale);
  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.file,
      submenu: [
        menuCommand(labels.newProject, 'newProject', 'CommandOrControl+N'),
        menuCommand(labels.openProject, 'openProject', 'CommandOrControl+O'),
        menuCommand(labels.saveProject, 'saveProject', 'CommandOrControl+S'),
        { type: 'separator' },
        menuCommand(labels.exportProject, 'exportProject', 'CommandOrControl+E'),
        { type: 'separator' },
        menuCommand(labels.quit, 'quit', process.platform === 'darwin' ? 'Command+Q' : 'Alt+F4')
      ]
    },
    {
      label: labels.edit,
      submenu: [
        menuCommand(labels.undo, 'undo', 'CommandOrControl+Z'),
        menuCommand(labels.redo, 'redo', 'CommandOrControl+Shift+Z'),
        { type: 'separator' },
        { label: labels.cut, role: 'cut' },
        { label: labels.copy, role: 'copy' },
        { label: labels.paste, role: 'paste' },
        { label: labels.delete, role: 'delete' },
        { type: 'separator' },
        { label: labels.selectAll, role: 'selectAll' }
      ]
    },
    {
      label: labels.view,
      submenu: [
        ...devMenuItems(labels),
        { label: labels.actualSize, role: 'resetZoom' },
        { label: labels.zoomIn, role: 'zoomIn' },
        { label: labels.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: labels.toggleFullScreen, role: 'togglefullscreen' }
      ]
    },
    {
      label: labels.window,
      submenu: [
        { label: labels.minimize, role: 'minimize' },
        { label: labels.close, role: 'close' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getMenuLabels(locale: LocaleCode): MenuLabels {
  const t = createTranslator(locale);
  return {
    file: t('menu.file'),
    newProject: t('menu.newProject'),
    openProject: t('menu.openProject'),
    saveProject: t('menu.saveProject'),
    exportProject: t('menu.exportProject'),
    quit: t('menu.quit'),
    edit: t('menu.edit'),
    undo: t('menu.undo'),
    redo: t('menu.redo'),
    cut: t('menu.cut'),
    copy: t('menu.copy'),
    paste: t('menu.paste'),
    delete: t('menu.delete'),
    selectAll: t('menu.selectAll'),
    view: t('menu.view'),
    reload: t('menu.reload'),
    forceReload: t('menu.forceReload'),
    toggleDevTools: t('menu.toggleDevTools'),
    actualSize: t('menu.actualSize'),
    zoomIn: t('menu.zoomIn'),
    zoomOut: t('menu.zoomOut'),
    toggleFullScreen: t('menu.toggleFullScreen'),
    window: t('menu.window'),
    minimize: t('menu.minimize'),
    close: t('menu.close')
  };
}

function devMenuItems(labels: MenuLabels): MenuItemConstructorOptions[] {
  if (app.isPackaged) {
    return [];
  }

  return [
    { label: labels.reload, role: 'reload' },
    { label: labels.forceReload, role: 'forceReload' },
    { label: labels.toggleDevTools, role: 'toggleDevTools' },
    { type: 'separator' }
  ];
}

function menuCommand(label: string, command: AppMenuCommand, accelerator?: string): MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    click: () => sendMenuCommand(command)
  };
}

function sendMenuCommand(command: AppMenuCommand): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!window || window.webContents.isDestroyed()) {
    if (command === 'quit') {
      app.quit();
    }
    return;
  }

  window.webContents.send('app:menu-command', command);
}
