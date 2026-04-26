import { ipcMain } from 'electron'
import RPC from 'discord-rpc'

const clientId = '1497599851595038750'

let rpcClient: RPC.Client | null = null
let isRpcReady = false

export function setupDiscordRpc() {
  RPC.register(clientId)
  rpcClient = new RPC.Client({ transport: 'ipc' })

  rpcClient.on('ready', () => {
    isRpcReady = true
    console.log('[Discord RPC] Ready')
  })

  rpcClient.login({ clientId }).catch((err) => {
    console.error('[Discord RPC] Failed to connect:', err)
  })

  ipcMain.on(
    'update-rpc',
    (
      _event,
      payload: {
        title?: string
        artist?: string
        duration?: number
        currentTime?: number
        isPlaying?: boolean
        thumbnailUrl?: string
      }
    ) => {
      if (!isRpcReady || !rpcClient) return

      try {
        if (!payload.isPlaying || !payload.title) {
          rpcClient.setActivity({
            details: 'Idle',
            instance: false,
          }).catch(console.error)
          return
        }

        const now = Date.now() / 1000
        const startTimestamp = Math.floor(now - (payload.currentTime || 0))
        const endTimestamp = payload.duration ? Math.floor(startTimestamp + payload.duration) : undefined

        rpcClient.setActivity({
          details: payload.title,
          state: payload.artist || 'Unknown Artist',
          startTimestamp,
          endTimestamp,
          largeImageKey: payload.thumbnailUrl || 'icon',
          largeImageText: 'Stanza',
          instance: false,
        }).catch(console.error)
      } catch (e) {
        console.error('[Discord RPC] Error setting activity:', e)
      }
    }
  )
}

export function clearDiscordRpcActivity() {
  if (isRpcReady && rpcClient) {
    rpcClient.setActivity({
      details: 'Idle',
      instance: false,
    }).catch(console.error)
  }
}
