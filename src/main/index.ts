import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { registerProjectIpc } from './ipc/project-ipc';

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

app.whenReady().then(() => {
  app.setAppUserModelId('com.suwol.suwol2danimator');
  registerProjectIpc();
  registerAppIpc();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function registerAppIpc(): void {
  ipcMain.handle('app:confirm-unsaved-changes', async (_event, projectName: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Changes',
      message: `${projectName || 'This project'} has unsaved changes.`,
      detail: 'Save before continuing, discard the changes, or cancel the action.'
    });

    return ['save', 'discard', 'cancel'][result.response] ?? 'cancel';
  });

  ipcMain.handle('app:force-close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.destroy();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
