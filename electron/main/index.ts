import './load-env'
import './innertube' // eval shim must be registered early
import { app, BrowserWindow, shell, ipcMain } from 'electron'
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

export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId('com.stanza.app')

registerPrivilegedVibestreamScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.cjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    title: 'Stanza',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
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

  // Mini-player handler
  let savedBounds: Electron.Rectangle | null = null
  ipcMain.handle(IpcChannels.setMiniPlayer, (_evt, enabled: boolean) => {
    if (!win) return
    if (enabled) {
      savedBounds = win.getBounds()
      win.setMinimumSize(350, 120)
      win.setSize(400, 140)
      win.setAlwaysOnTop(true)
      win.setResizable(false)
    } else {
      win.setAlwaysOnTop(false)
      win.setResizable(true)
      win.setMinimumSize(900, 600)
      if (savedBounds) {
        win.setBounds(savedBounds)
        savedBounds = null
      } else {
        win.setSize(1200, 800)
      }
    }
  })

  try {
    setupDiscordRpc()
  } catch (err) {
    console.error('[startup] Discord RPC failed:', err)
  }
  await createWindow()
  scheduleYtDlpUpdate()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
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
