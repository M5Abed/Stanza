import './load-env'
import './innertube' // eval shim must be registered early
import { app, BrowserWindow, shell, ipcMain, Tray, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { configureDatabaseUrl, disconnectPrisma, getPrisma } from './database'
import { registerPrivilegedVibestreamScheme, registerVibestreamProtocolHandler } from './register-protocol'
import { registerIpcHandlers } from './ipc-handlers'
import { seedDefaultCleaningTerms } from './seed-defaults'
import { setupDiscordRpc } from './discord-rpc'
import { ensureBaseSchema } from './schema-bootstrap'
import { ensureOfflineDirs, evictLRUCache } from './audio-cache'
import { scheduleYtDlpUpdate } from './ytdlp-updater'
import { IpcChannels } from '../../shared/ipc-channels'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

import fs from 'node:fs'
const logFile = path.join(os.homedir(), 'Desktop', 'stanza-global-error.log')
process.on('uncaughtException', (err) => {
  try { fs.appendFileSync(logFile, `[uncaughtException] ${err?.stack || err}\n`) } catch {}
})
process.on('unhandledRejection', (reason) => {
  try { fs.appendFileSync(logFile, `[unhandledRejection] ${reason}\n`) } catch {}
})

export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId('com.mohamedabed.stanza')
app.setName('Stanza')

// Prevent Chromium from throttling the renderer process when minimized/backgrounded,
// which causes Howler.js / HTML5 audio to stutter.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
// Prevent Windows native occlusion detection from throttling when app is behind other windows
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

registerPrivilegedVibestreamScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let floatingLyricsWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const preload = path.join(__dirname, '../preload/index.cjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// ── Floating Lyrics Window ──
function setupFloatingLyricsIpc() {
  ipcMain.handle(IpcChannels.floatingLyricsOpen, async () => {
    if (floatingLyricsWin && !floatingLyricsWin.isDestroyed()) {
      floatingLyricsWin.focus()
      return { ok: true }
    }

    floatingLyricsWin = new BrowserWindow({
      width: 420,
      height: 520,
      minWidth: 280,
      minHeight: 200,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
      },
    })

    if (VITE_DEV_SERVER_URL) {
      await floatingLyricsWin.loadURL(`${VITE_DEV_SERVER_URL}?mode=floating-lyrics`)
    } else {
      await floatingLyricsWin.loadFile(indexHtml, { query: { mode: 'floating-lyrics' } })
    }

    floatingLyricsWin.on('closed', () => {
      floatingLyricsWin = null
      // Notify main renderer that floating window was closed
      win?.webContents.send(IpcChannels.floatingLyricsClosed)
    })

    return { ok: true }
  })

  ipcMain.handle(IpcChannels.floatingLyricsClose, () => {
    if (floatingLyricsWin && !floatingLyricsWin.isDestroyed()) {
      floatingLyricsWin.close()
    }
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.floatingLyricsTogglePin, () => {
    if (floatingLyricsWin && !floatingLyricsWin.isDestroyed()) {
      const current = floatingLyricsWin.isAlwaysOnTop()
      floatingLyricsWin.setAlwaysOnTop(!current)
      return { pinned: !current }
    }
    return { pinned: false }
  })

  // Relay lyrics state from main renderer to floating window
  ipcMain.on(IpcChannels.floatingLyricsState, (_event, data) => {
    if (floatingLyricsWin && !floatingLyricsWin.isDestroyed()) {
      floatingLyricsWin.webContents.send(IpcChannels.floatingLyricsState, data)
    }
  })
}

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    title: 'Stanza',
    icon: path.join(process.env.VITE_PUBLIC, 'icon.ico'),
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0002',
      symbolColor: '#a7a7a7',
      height: 38
    },
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged,
      backgroundThrottling: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    await win.loadURL(VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools({ mode: 'detach' })
  } else {
    await win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  // Notify renderer about visibility changes so it can freeze UI when backgrounded
  win.on('minimize', () => {
    win?.webContents.send(IpcChannels.appVisibilityChange, { visible: false })
  })
  win.on('hide', () => {
    win?.webContents.send(IpcChannels.appVisibilityChange, { visible: false })
  })
  win.on('restore', () => {
    win?.webContents.send(IpcChannels.appVisibilityChange, { visible: true })
  })
  win.on('show', () => {
    win?.webContents.send(IpcChannels.appVisibilityChange, { visible: true })
  })

  update(win)
}

app.whenReady().then(async () => {
  try {
    configureDatabaseUrl()
    const prisma = getPrisma()
    await prisma.$connect()
    await ensureBaseSchema(prisma)
    await seedDefaultCleaningTerms(prisma)
  } catch (err: any) {
    console.error('[startup] Database init failed, continuing without DB:', err)
    try {
      import('node:fs').then(fs => {
        fs.writeFileSync(require('node:path').join(app.getPath('userData'), 'db-error.log'), String(err) + '\n' + (err.stack || ''))
      })
    } catch (e) {}
  }
  try {
    registerVibestreamProtocolHandler()
  } catch (err) {
    console.error('[startup] Protocol handler failed:', err)
  }
  try {
    ensureOfflineDirs()
    evictLRUCache()
  } catch (err) {
    console.error('[startup] Cache init failed:', err)
  }
  try {
    registerIpcHandlers()
  } catch (err) {
    console.error('[startup] IPC handlers failed:', err)
  }

  setupFloatingLyricsIpc()



  try {
    setupDiscordRpc()
  } catch (err) {
    console.error('[startup] Discord RPC failed:', err)
  }
  await createWindow()
  
  // Setup System Tray
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.ico')
  tray = new Tray(iconPath)
  tray.setToolTip('Stanza')
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (win) {
      win.isVisible() ? win.focus() : win.show()
    }
  })

  // Start with Windows by default
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
  })
  
  scheduleYtDlpUpdate()
})

app.on('window-all-closed', () => {
  win = null
  // We don't quit on window-all-closed because we rely on the tray to keep the app alive
})

app.on('before-quit', () => {
  isQuitting = true
  void disconnectPrisma()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    void createWindow()
  }
})
