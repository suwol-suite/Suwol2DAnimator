import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerProjectIpc } from './ipc/project-ipc';
import { defaultAppSettings, normalizeAppSettings, normalizeUpdateSettings, type AppSettings, type UpdateSettings } from '../shared/app-settings';
import { createTranslator } from '../shared/i18n/translate';
import { fallbackLocale, normalizeLocale } from '../shared/i18n/locale-manifest';
import { configureApplicationMenu } from './menu';
import { LinuxUpdateService } from './update/linux-update-service';

const linuxUpdateService = new LinuxUpdateService();

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

  ipcMain.handle('app:save-settings', async (_event, settings: Partial<AppSettings>): Promise<AppSettings> => {
    const normalized = normalizeAppSettings(mergeAppSettings(await readAppSettings(), settings));
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

  ipcMain.handle('update:get-settings', async (): Promise<UpdateSettings> => {
    return (await readAppSettings()).updates;
  });

  ipcMain.handle('update:save-settings', async (_event, settings: Partial<UpdateSettings>): Promise<UpdateSettings> => {
    const current = await readAppSettings();
    const next = normalizeAppSettings({
      ...current,
      updates: {
        ...current.updates,
        ...settings
      }
    });
    await writeAppSettings(next);
    return next.updates;
  });

  ipcMain.handle('update:check', async () => {
    const result = await linuxUpdateService.checkForUpdates();
    await saveUpdateLastCheckAt();
    return result;
  });

  ipcMain.handle('update:download', async () => {
    return linuxUpdateService.downloadUpdate();
  });

  ipcMain.handle('update:install-and-restart', async () => {
    return linuxUpdateService.installUpdateAndRestart();
  });

  ipcMain.handle('update:open-download-folder', async () => {
    return linuxUpdateService.openDownloadedUpdateFolder();
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
    return normalizeAppSettings({ locale: 'ko' });
  }

  if (!osLocale) {
    return defaultAppSettings;
  }

  return normalizeAppSettings({ locale: fallbackLocale });
}

async function writeAppSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getAppSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(normalizeAppSettings(settings), null, 2)}\n`, 'utf8');
}

function getAppSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function mergeAppSettings(current: AppSettings, incoming: Partial<AppSettings>): AppSettings {
  return normalizeAppSettings({
    ...current,
    ...incoming,
    updates: {
      ...current.updates,
      ...(incoming.updates ?? {})
    }
  });
}

async function saveUpdateLastCheckAt(): Promise<void> {
  const current = await readAppSettings();
  const next = normalizeAppSettings({
    ...current,
    updates: normalizeUpdateSettings({
      ...current.updates,
      lastCheckAt: new Date().toISOString()
    })
  });
  await writeAppSettings(next);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
