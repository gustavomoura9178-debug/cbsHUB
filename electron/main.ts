import { validateNotice, callToastXml } from "./notifications";
import { BackgroundNotice } from "./background";
import {
  trustedRenderer,
  externalLink,
  validCaptureSource,
  permittedCapability,
} from "./security";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
  shell,
  Tray,
  Menu,
  nativeImage,
  dialog,
  Notification,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as electronUpdater from "electron-updater";
import type { AppUpdateState } from "../src/types/cbshub";

const autoUpdater =
  electronUpdater.autoUpdater ||
  (electronUpdater as unknown as { default?: typeof electronUpdater }).default
    ?.autoUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Flags de Aceleração de Hardware no Chromium (Seção 4.2 do SDD.md)
app.commandLine.appendSwitch(
  "enable-features",
  "WebRTCPipeWireCapturer,VaapiVideoDecoder,VaapiVideoEncoder",
);
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

const rendererUrl =
  process.env.VITE_DEV_SERVER_URL ||
  pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
let mainWindow: BrowserWindow | null = null;
let updaterWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let trayCallState = { inVoiceCall: false, reconnecting: false };
const noticePath = () =>
  path.join(app.getPath("userData"), "desktop-notice.json");
let noticeAcknowledged = false;
try {
  noticeAcknowledged =
    JSON.parse(fs.readFileSync(noticePath(), "utf8")).acknowledged === true;
} catch {}
const backgroundNotice = new BackgroundNotice(noticeAcknowledged);
function hideToBackground() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!tray || tray.isDestroyed()) {
    mainWindow.minimize();
    return;
  }
  const win = mainWindow;
  void backgroundNotice.request(
    () =>
      dialog.showMessageBox(win, {
        type: "info",
        title: "cbsHUB em segundo plano",
        message: "O cbsHUB continuará na bandeja.",
        detail:
          "Chamadas, microfone e mensagens continuam ativos. Use Abrir para voltar ou Encerrar cbsHUB no menu da bandeja para sair.",
        buttons: ["Entendi"],
        noLink: true,
      }),
    () => {
      if (!win.isDestroyed()) win.hide();
    },
    () => quitting,
    () => {
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      const temporary = noticePath() + ".tmp";
      fs.writeFileSync(temporary, JSON.stringify({ acknowledged: true }));
      fs.renameSync(temporary, noticePath());
    },
  );
}
function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const status = trayCallState.reconnecting
    ? "Reconectando à sala"
    : trayCallState.inVoiceCall
      ? "Em chamada"
      : "Disponível";
  tray.setToolTip("cbsHUB — " + status);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir cbsHUB", click: restoreWindow },
      {
        label: mainWindow?.isVisible() ? "Ocultar janela" : "Mostrar janela",
        click: () =>
          mainWindow?.isVisible() ? hideToBackground() : restoreWindow(),
      },
      { label: status, enabled: false },
      { type: "separator" },
      {
        label: "Encerrar cbsHUB",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}
app.setAppUserModelId("com.will.cbshub");
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
function restoreWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function createTray() {
  if (tray && !tray.isDestroyed()) return;
  if (app.commandLine.getSwitchValue("ozone-platform") === "headless") {
    console.warn(
      "[Desktop] Sem display para bandeja; fechar minimizará a janela.",
    );
    return;
  }
  try {
    const iconPath = path.join(
      app.getAppPath(),
      process.env.VITE_DEV_SERVER_URL ? "public/brand" : "dist/brand",
      process.platform === "win32" ? "app.ico" : "logo-32.png",
    );
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw Error("Ícone de bandeja indisponível");
    tray = new Tray(icon);
    refreshTrayMenu();
    tray.on("click", restoreWindow);
    tray.on("double-click", restoreWindow);
  } catch (error) {
    console.warn("[Desktop] Bandeja indisponível; fechar minimizará a janela.");
    tray = null;
  }
}
app.on("second-instance", () => {
  if (app.isReady()) restoreWindow();
});
app.on("before-quit", () => {
  quitting = true;
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.destroy();
    updaterWindow = null;
  }
  tray?.destroy();
  tray = null;
});
function allowedSender(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
): boolean {
  return (
    !!mainWindow &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame &&
    trustedRenderer(event.senderFrame.url, rendererUrl)
  );
}
function allowedUpdaterSender(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
): boolean {
  if (!event.senderFrame || !trustedRenderer(event.senderFrame.url, rendererUrl)) {
    return false;
  }
  const fromMain =
    !!mainWindow &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame;
  const fromUpdater =
    !!updaterWindow &&
    !updaterWindow.isDestroyed() &&
    event.sender === updaterWindow.webContents &&
    event.senderFrame === updaterWindow.webContents.mainFrame;
  return fromMain || fromUpdater;
}
let pendingSourceId: string | null = null;
let pendingSystemAudio = true;

function getPreloadPath(): string {
  const candidates = [
    path.join(__dirname, "preload.cjs"),
    path.join(__dirname, "preload.js"),
    path.join(app.getAppPath(), "dist-electron", "preload.cjs"),
    path.join(app.getAppPath(), "dist-electron", "preload.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log("[cbsHUB Main] Preload script encontrado:", candidate);
      return candidate;
    }
  }

  const fallback = path.join(__dirname, "preload.cjs");
  console.warn(
    "[cbsHUB Main] Preload não encontrado nos caminhos padrão, usando fallback:",
    fallback,
  );
  return fallback;
}

function createWindow(startHidden = false): void {
  const preloadPath = getPreloadPath();

  mainWindow = new BrowserWindow({
    icon: path.join(
      app.getAppPath(),
      process.env.VITE_DEV_SERVER_URL
        ? "public/brand/logo-256.png"
        : "dist/brand/logo-256.png",
    ),
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: !startHidden,
    frame: false,
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (externalLink(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!trustedRenderer(url, rendererUrl)) event.preventDefault();
  });
  mainWindow.webContents.on("preload-error", (_event, failedPath, error) => {
    console.error(
      "[cbsHUB Main] Falha no script de Preload:",
      failedPath,
      error,
    );
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Notifica o frontend quando a janela for maximizada/restaurada via SO
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("cbs:window-state-changed", {
      isMaximized: true,
    });
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("cbs:window-state-changed", {
      isMaximized: false,
    });
  });

  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    hideToBackground();
  });
  mainWindow.on("show", refreshTrayMenu);
  mainWindow.on("hide", refreshTrayMenu);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const notices = new Map<string, Notification>();
const seenNotices = new Set<string>();
let lastNotice = 0;

function resolveBrandIcon(fileName: string): string | undefined {
  const iconPath = path.join(
    app.getAppPath(),
    process.env.VITE_DEV_SERVER_URL ? "public/brand" : "dist/brand",
    fileName,
  );
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

ipcMain.handle("cbs:notify", (event, input: unknown) => {
  if (!allowedSender(event)) return false;
  const request = validateNotice(input);
  if (!request || !Notification.isSupported() || seenNotices.has(request.id))
    return false;
  seenNotices.add(request.id);
  if (seenNotices.size > 200)
    seenNotices.delete(seenNotices.values().next().value!);

  const isWindowFocusedVisible =
    Boolean(mainWindow) &&
    !mainWindow!.isDestroyed() &&
    mainWindow!.isVisible() &&
    !mainWindow!.isMinimized() &&
    mainWindow!.isFocused();

  // Mensagens e pedidos de amizade suprimem apenas se a janela já estiver visível e em foco;
  // chamadas sempre notificam (mesmo minimizado ou na bandeja).
  if (request.kind !== "call" && isWindowFocusedVisible) {
    return false;
  }

  if (Date.now() - lastNotice < 800) return false;
  lastNotice = Date.now();
  while (notices.size >= 10) {
    const key = notices.keys().next().value!;
    notices.get(key)?.close();
    notices.delete(key);
  }

  const iconPath = resolveBrandIcon("logo-256.png");

  const showNativeNotification = (useToastXml: boolean) => {
    try {
      const notice = new Notification({
        title: request.title,
        body: request.body,
        icon: iconPath,
        ...(useToastXml && request.kind === "call" && process.platform === "win32"
          ? { toastXml: callToastXml(request.title, request.body) }
          : {}),
        ...(request.kind === "call" && process.platform === "darwin"
          ? { actions: [{ type: "button" as const, text: "Atender" }] }
          : {}),
      });
      notices.set(request.id, notice);
      let activated = false;
      const accept = () => {
        if (activated || !notices.has(request.id)) return;
        activated = true;
        restoreWindow();
        mainWindow?.webContents.send("cbs:notification-activated", request.id);
        notice.close();
        notices.delete(request.id);
      };
      notice.on("click", accept);
      notice.on("action", accept);
      notice.on("close", () => notices.delete(request.id));
      notice.on("failed", () => {
        notices.delete(request.id);
        if (useToastXml) {
          showNativeNotification(false);
        }
      });
      setTimeout(() => {
        notice.close();
        notices.delete(request.id);
      }, 30000).unref();
      notice.show();
    } catch {
      if (useToastXml) {
        showNativeNotification(false);
      }
    }
  };

  showNativeNotification(request.kind === "call" && process.platform === "win32");
  return true;
});

let currentUpdateState: AppUpdateState = { status: "idle" };
let updateFlowActive = false;
let installScheduled = false;

function extractReleaseNotes(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(raw)) {
    const joined = raw
      .map((entry) =>
        entry && typeof entry === "object" && "note" in entry
          ? String((entry as { note?: unknown }).note || "")
          : "",
      )
      .filter(Boolean)
      .join("\n")
      .trim();
    return joined || undefined;
  }
  return undefined;
}

function sendUpdateStatus(state: AppUpdateState): void {
  currentUpdateState = state;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("cbs:update-status", state);
  }
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send("cbs:update-status", state);
  }
}

function createUpdaterWindow(): BrowserWindow {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    if (updaterWindow.isMinimized()) updaterWindow.restore();
    updaterWindow.show();
    updaterWindow.focus();
    return updaterWindow;
  }

  const preloadPath = getPreloadPath();

  updaterWindow = new BrowserWindow({
    icon: path.join(
      app.getAppPath(),
      process.env.VITE_DEV_SERVER_URL
        ? "public/brand/logo-256.png"
        : "dist/brand/logo-256.png",
    ),
    width: 340,
    height: 390,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  updaterWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (externalLink(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  updaterWindow.webContents.on("will-navigate", (event, url) => {
    if (!trustedRenderer(url, rendererUrl)) event.preventDefault();
  });
  updaterWindow.webContents.on("preload-error", (_event, failedPath, error) => {
    console.error(
      "[cbsHUB Updater] Falha no script de Preload:",
      failedPath,
      error,
    );
  });

  updaterWindow.webContents.once("did-finish-load", () => {
    if (updaterWindow && !updaterWindow.isDestroyed()) {
      updaterWindow.webContents.send("cbs:update-status", currentUpdateState);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = new URL(process.env.VITE_DEV_SERVER_URL);
    devUrl.searchParams.set("window", "updater");
    void updaterWindow.loadURL(devUrl.toString());
  } else {
    void updaterWindow.loadFile(path.join(__dirname, "../dist/index.html"), {
      query: { window: "updater" },
    });
  }

  updaterWindow.on("closed", () => {
    updaterWindow = null;
    if (!quitting && updateFlowActive) {
      updateFlowActive = false;
      restoreWindow();
    }
  });

  return updaterWindow;
}

function triggerSilentInstall(targetVersion?: string): void {
  if (installScheduled) return;
  installScheduled = true;
  sendUpdateStatus({
    status: "installing",
    version: targetVersion || currentUpdateState.version,
    releaseNotes: currentUpdateState.releaseNotes,
    percent: 100,
    transferred: currentUpdateState.total || currentUpdateState.transferred,
    total: currentUpdateState.total,
  });

  setTimeout(() => {
    quitting = true;
    tray?.destroy();
    tray = null;
    if (updaterWindow && !updaterWindow.isDestroyed()) {
      updaterWindow.destroy();
      updaterWindow = null;
    }
    autoUpdater?.quitAndInstall(true, true);
  }, 700);
}

let updaterInitialized = false;
function setupAutoUpdater(): void {
  if (updaterInitialized || !app.isPackaged || !autoUpdater) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus({ status: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({
      status: "available",
      version: info.version,
      releaseNotes: extractReleaseNotes(info.releaseNotes),
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    sendUpdateStatus({ status: "not-available", version: info.version });
  });
  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({
      status: "downloading",
      version: currentUpdateState.version,
      releaseNotes: currentUpdateState.releaseNotes,
      percent: Math.min(100, Math.max(0, Math.round(progress.percent || 0))),
      bytesPerSecond: Number.isFinite(progress.bytesPerSecond)
        ? progress.bytesPerSecond
        : 0,
      transferred: Number.isFinite(progress.transferred)
        ? progress.transferred
        : 0,
      total: Number.isFinite(progress.total) ? progress.total : 0,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    const targetVersion = info?.version || currentUpdateState.version;
    if (updateFlowActive || (updaterWindow && !updaterWindow.isDestroyed())) {
      triggerSilentInstall(targetVersion);
      return;
    }
    sendUpdateStatus({
      status: "downloaded",
      version: targetVersion,
      releaseNotes: currentUpdateState.releaseNotes,
      percent: 100,
    });
  });
  autoUpdater.on("error", (err) => {
    sendUpdateStatus({
      status: "error",
      version: currentUpdateState.version,
      releaseNotes: currentUpdateState.releaseNotes,
      message:
        err instanceof Error
          ? err.message
          : "Não foi possível verificar atualizações.",
    });
  });
}

ipcMain.handle("cbs:get-update-state", (event) => {
  if (!allowedUpdaterSender(event)) return { status: "idle" } as AppUpdateState;
  return currentUpdateState;
});

ipcMain.handle("cbs:check-updates", async (event) => {
  if (!allowedUpdaterSender(event)) return;
  if (!app.isPackaged || !autoUpdater) {
    sendUpdateStatus({ status: "not-available" });
    return;
  }
  setupAutoUpdater();
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    sendUpdateStatus({
      status: "error",
      message:
        err instanceof Error ? err.message : "Erro ao verificar atualizações.",
    });
  }
});

ipcMain.handle("cbs:download-update", async (event) => {
  if (!allowedUpdaterSender(event)) return;
  if (!app.isPackaged || !autoUpdater) return;
  setupAutoUpdater();
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    sendUpdateStatus({
      status: "error",
      version: currentUpdateState.version,
      message:
        err instanceof Error ? err.message : "Erro ao baixar atualização.",
    });
  }
});

ipcMain.handle("cbs:start-update-flow", async (event) => {
  if (!allowedUpdaterSender(event)) return;
  updateFlowActive = true;
  installScheduled = false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  createUpdaterWindow();

  if (currentUpdateState.status === "downloaded") {
    triggerSilentInstall(currentUpdateState.version);
    return;
  }

  if (!app.isPackaged || !autoUpdater) {
    sendUpdateStatus({
      status: "error",
      version: currentUpdateState.version,
      message:
        "A atualização automática está disponível apenas no aplicativo desktop instalado.",
    });
    return;
  }

  setupAutoUpdater();
  sendUpdateStatus({
    status: "downloading",
    version: currentUpdateState.version,
    releaseNotes: currentUpdateState.releaseNotes,
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
  });

  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    sendUpdateStatus({
      status: "error",
      version: currentUpdateState.version,
      releaseNotes: currentUpdateState.releaseNotes,
      message:
        err instanceof Error ? err.message : "Erro ao baixar atualização.",
    });
  }
});

ipcMain.on("cbs:cancel-update-window", (event) => {
  if (!allowedUpdaterSender(event)) return;
  updateFlowActive = false;
  installScheduled = false;
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.close();
  }
  updaterWindow = null;
  restoreWindow();
});

ipcMain.on("cbs:install-update", (event) => {
  if (!allowedUpdaterSender(event)) return;
  if (!app.isPackaged || !autoUpdater) return;
  quitting = true;
  tray?.destroy();
  tray = null;
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.destroy();
    updaterWindow = null;
  }
  autoUpdater.quitAndInstall(true, true);
});

function readAutoLaunchState(): { enabled: boolean; supported: boolean } {
  if (!app.isPackaged) {
    return { enabled: false, supported: false };
  }
  try {
    const settings = app.getLoginItemSettings({
      path: process.execPath,
      args: ["--autostart"],
    });
    return { enabled: Boolean(settings.openAtLogin), supported: true };
  } catch {
    return { enabled: false, supported: false };
  }
}

ipcMain.handle("cbs:get-auto-launch", (event) => {
  if (!allowedSender(event)) throw new Error("Origem IPC não autorizada.");
  return readAutoLaunchState();
});

ipcMain.handle("cbs:set-auto-launch", (event, enabled: unknown) => {
  if (!allowedSender(event)) throw new Error("Origem IPC não autorizada.");
  if (typeof enabled !== "boolean") {
    return readAutoLaunchState();
  }
  if (!app.isPackaged) {
    return { enabled: false, supported: false };
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: ["--autostart"],
    });
  } catch (err) {
    console.warn("[Desktop] Erro ao configurar inicialização automática:", err);
  }
  return readAutoLaunchState();
});

ipcMain.on("cbs:tray-state", (event, state: unknown) => {
  if (!allowedSender(event) || !state || typeof state !== "object") return;
  const x = state as Record<string, unknown>;
  if (
    Object.keys(x).some((k) => !["inVoiceCall", "reconnecting"].includes(k)) ||
    typeof x.inVoiceCall !== "boolean" ||
    typeof x.reconnecting !== "boolean"
  )
    return;
  trayCallState = { inVoiceCall: x.inVoiceCall, reconnecting: x.reconnecting };
  refreshTrayMenu();
});

ipcMain.handle("cbs:desktop-state", (event) => {
  if (!allowedSender(event)) throw Error("Origem IPC não autorizada.");
  return {
    trayAvailable: !!tray && !tray.isDestroyed(),
    hidden: !!mainWindow && !mainWindow.isVisible(),
  };
});

ipcMain.handle("cbs:window-state", (event) => {
  if (!allowedSender(event)) throw new Error("Origem IPC não autorizada.");
  return { isMaximized: mainWindow!.isMaximized() };
});

// Interceptador IPC de busca de fontes de desktop
ipcMain.handle("cbs:get-sources", async (event) => {
  if (!allowedSender(event)) throw new Error("Origem IPC não autorizada.");
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 480, height: 270 },
    fetchWindowIcons: true,
  });

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL(),
    appIconDataUrl: s.appIcon ? s.appIcon.toDataURL() : null,
    isScreen: s.id.startsWith("screen:"),
  }));
});

// Interceptador IPC para configurar a fonte escolhida pelo usuário
ipcMain.handle(
  "cbs:set-capture-source",
  (event, sourceId: string, includeAudio: boolean) => {
    if (!allowedSender(event) || !validCaptureSource(sourceId, includeAudio)) {
      pendingSourceId = null;
      return false;
    }
    pendingSourceId = sourceId;
    pendingSystemAudio = includeAudio;
    return true;
  },
);

// Handlers de controle de janela nativa blindados contra perda de referência
ipcMain.on("cbs:minimize", (event) => {
  if (!allowedSender(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on("cbs:maximize", (event) => {
  if (!allowedSender(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on("cbs:close", (event) => {
  if (!allowedSender(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

ipcMain.on("cbs:always-on-top", (event, flag: boolean) => {
  if (!allowedSender(event) || typeof flag !== "boolean") return;
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(flag);
  }
});

if (primaryInstance)
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback, details) => {
        callback(
          contents === mainWindow?.webContents &&
            permittedCapability(
              permission,
              details.requestingUrl || contents.getURL(),
              rendererUrl,
              details.isMainFrame !== false,
            ),
        );
      },
    );
    session.defaultSession.setPermissionCheckHandler(
      (contents, permission, _origin, details) => {
        return (
          contents === mainWindow?.webContents &&
          permittedCapability(
            permission,
            details.requestingUrl || contents?.getURL() || "",
            rendererUrl,
            details.isMainFrame !== false,
          )
        );
      },
    );
    // Interceptador oficial do Electron para getDisplayMedia (Seção 4.1 do SDD.md)
    session.defaultSession.setDisplayMediaRequestHandler(
      async (request, callback) => {
        const sourceId = pendingSourceId;
        pendingSourceId = null;
        if (
          !request.frame ||
          request.frame !== mainWindow?.webContents.mainFrame ||
          !trustedRenderer(request.frame.url, rendererUrl) ||
          !sourceId
        ) {
          callback({});
          return;
        }
        let sources: Electron.DesktopCapturerSource[];
        try {
          sources = await desktopCapturer.getSources({
            types: ["screen", "window"],
          });
        } catch {
          callback({});
          return;
        }
        const chosen = sources.find((s) => s.id === sourceId);

        if (!chosen) {
          callback({});
          return;
        }

        callback({
          video: chosen,
          audio: pendingSystemAudio ? "loopback" : undefined,
        });
      },
    );

    const startedViaAutostart = process.argv.includes("--autostart");
    createTray();
    const shouldStartHidden =
      startedViaAutostart && Boolean(tray && !tray.isDestroyed());
    createWindow(shouldStartHidden);
    refreshTrayMenu();
    setupAutoUpdater();
    if (app.isPackaged && autoUpdater) {
      setTimeout(() => {
        void autoUpdater.checkForUpdates().catch(() => {});
      }, 5000).unref();
    }
    app.on("activate", restoreWindow);
  });

app.on("window-all-closed", () => {
  if (quitting) {
    app.quit();
  }
});
