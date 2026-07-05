import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerProjectIpc } from './ipc/project-ipc';
import { defaultAppSettings, normalizeAppSettings, type AppSettings } from '../shared/app-settings';
import { createTranslator } from '../shared/i18n/translate';
import { fallbackLocale, normalizeLocale } from '../shared/i18n/locale-manifest';
import { configureApplicationMenu } from './menu';

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    title: 'Suwol 2D Animator',
    backgroundColor: '#101418',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (mainWindow.webContents.isDestroyed()) {
      return;
    }

    event.preventDefault();
    mainWindow.webContents.send('app:request-close');
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.suwol.suwol2danimator');
  registerProjectIpc();
  registerAppIpc();
  configureApplicationMenu((await readAppSettings()).locale);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function registerAppIpc(): void {
  ipcMain.handle('app:get-settings', async (): Promise<AppSettings> => {
    return readAppSettings();
  });

  ipcMain.handle('app:save-settings', async (_event, settings: AppSettings): Promise<AppSettings> => {
    const normalized = normalizeAppSettings(settings);
    await writeAppSettings(normalized);
    configureApplicationMenu(normalized.locale);
    return normalized;
  });

  ipcMain.handle('app:confirm-unsaved-changes', async (_event, projectName: string, locale?: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const t = createTranslator(normalizeLocale(locale));
    const safeProjectName = projectName || t('dialog.thisProject');
    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: [t('common.save'), t('common.discard'), t('common.cancel')],
      defaultId: 0,
      cancelId: 2,
      title: t('dialog.unsavedTitle'),
      message: t('dialog.unsavedMessage', { projectName: safeProjectName }),
      detail: t('dialog.unsavedDetail')
    });

    return ['save', 'discard', 'cancel'][result.response] ?? 'cancel';
  });

  ipcMain.handle('app:force-close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.destroy();
  });
}

async function readAppSettings(): Promise<AppSettings> {
  const settingsPath = getAppSettingsPath();
  try {
    const raw = await readFile(settingsPath, 'utf8');
    return normalizeAppSettings(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return detectInitialAppSettings();
    }

    throw error;
  }
}

function detectInitialAppSettings(): AppSettings {
  const osLocale = app.getLocale().toLowerCase();
  if (osLocale === 'ko' || osLocale.startsWith('ko-')) {
    return { locale: 'ko' };
  }

  if (!osLocale) {
    return defaultAppSettings;
  }

  return { locale: fallbackLocale };
}

async function writeAppSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getAppSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(normalizeAppSettings(settings), null, 2)}\n`, 'utf8');
}

function getAppSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
