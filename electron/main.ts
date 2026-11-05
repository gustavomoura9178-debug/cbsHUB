import {trustedRenderer,externalLink,validCaptureSource,permittedCapability} from './security';
import {pathToFileURL} from 'node:url';
import { app, BrowserWindow, ipcMain, desktopCapturer, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Flags de Aceleração de Hardware no Chromium (Seção 4.2 do SDD.md)
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer,VaapiVideoDecoder,VaapiVideoEncoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const rendererUrl = process.env.VITE_DEV_SERVER_URL || pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
let mainWindow: BrowserWindow | null = null;
function allowedSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
 return !!mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && trustedRenderer(event.senderFrame.url, rendererUrl);
}
let pendingSourceId: string | null = null;
let pendingSystemAudio = true;

function getPreloadPath(): string {
  const candidates = [
    path.join(__dirname, 'preload.cjs'),
    path.join(__dirname, 'preload.js'),
    path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'),
    path.join(app.getAppPath(), 'dist-electron', 'preload.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log('[cbsHUB Main] Preload script encontrado:', candidate);
      return candidate;
    }
  }

  const fallback = path.join(__dirname, 'preload.cjs');
  console.warn('[cbsHUB Main] Preload não encontrado nos caminhos padrão, usando fallback:', fallback);
  return fallback;
}

function createWindow(): void {
  const preloadPath = getPreloadPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#09090b',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => { if(externalLink(url)) void shell.openExternal(url); return {action:'deny'}; });
  mainWindow.webContents.on('will-navigate', (event,url) => { if(!trustedRenderer(url,rendererUrl)) event.preventDefault(); });
  mainWindow.webContents.on('preload-error' , (_event, failedPath, error) => {
    console.error('[cbsHUB Main] Falha no script de Preload:', failedPath, error);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Notifica o frontend quando a janela for maximizada/restaurada via SO
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('cbs:window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('cbs:window-state-changed', { isMaximized: false });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('cbs:window-state', event => {
  if (!allowedSender(event)) throw new Error('Origem IPC não autorizada.');
  return {isMaximized:mainWindow!.isMaximized()};
});

// Interceptador IPC de busca de fontes de desktop
ipcMain.handle('cbs:get-sources', async (event) => {
  if(!allowedSender(event)) throw new Error('Origem IPC não autorizada.');
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 480, height: 270 },
    fetchWindowIcons: true,
  });

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL(),
    appIconDataUrl: s.appIcon ? s.appIcon.toDataURL() : null,
    isScreen: s.id.startsWith('screen:'),
  }));
});

// Interceptador IPC para configurar a fonte escolhida pelo usuário
ipcMain.handle('cbs:set-capture-source', (event, sourceId: string, includeAudio: boolean) => {
  if(!allowedSender(event) || !validCaptureSource(sourceId,includeAudio)) { pendingSourceId = null; return false; }
  pendingSourceId = sourceId;
  pendingSystemAudio = includeAudio;
  return true;
});

// Handlers de controle de janela nativa blindados contra perda de referência
ipcMain.on('cbs:minimize', (event) => {
  if(!allowedSender(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on('cbs:maximize', (event) => {
  if(!allowedSender(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('cbs:close', (event) => {
  if(!allowedSender(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

ipcMain.on('cbs:always-on-top', (event, flag: boolean) => {
  if(!allowedSender(event) || typeof flag !== 'boolean') return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(flag);
  }
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === mainWindow?.webContents && permittedCapability(permission, details.requestingUrl || contents.getURL(), rendererUrl, details.isMainFrame !== false));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => {
    return contents === mainWindow?.webContents && permittedCapability(permission, details.requestingUrl || contents?.getURL() || '', rendererUrl, details.isMainFrame !== false);
  });
  // Interceptador oficial do Electron para getDisplayMedia (Seção 4.1 do SDD.md)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const sourceId = pendingSourceId; pendingSourceId = null;
    if (!request.frame || request.frame !== mainWindow?.webContents.mainFrame || !trustedRenderer(request.frame.url,rendererUrl) || !sourceId) { callback({}); return; }
    let sources: Electron.DesktopCapturerSource[];
    try { sources = await desktopCapturer.getSources({ types: ['screen', 'window'] }); } catch { callback({}); return; }
    const chosen = sources.find((s) => s.id === sourceId);

    if (!chosen) {
      callback({});
      return;
    }

    callback({
      video: chosen,
      audio: pendingSystemAudio ? 'loopback' : undefined,
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
