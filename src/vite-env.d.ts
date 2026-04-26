/// <reference types="vite/client" />

interface Window {
  /** Electron preload only; absent when the renderer is opened in a plain browser. */
  ipcRenderer?: import('electron').IpcRenderer
  vibestream?: import('./type/vibestream-preload').VibestreamPreload
}
