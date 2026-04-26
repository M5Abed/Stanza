import type { IpcRendererEvent } from 'electron'
import type { ProgressInfo } from 'electron-updater'
import { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/update/Modal'
import Progress from '@/components/update/Progress'
import './update.css'

type Ipc = NonNullable<Window['ipcRenderer']>

function UpdateWithIpc({ ipc }: { ipc: Ipc }) {
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [versionInfo, setVersionInfo] = useState<VersionInfo>()
  const [updateError, setUpdateError] = useState<ErrorType>()
  const [progressInfo, setProgressInfo] = useState<Partial<ProgressInfo>>()
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string
    okText?: string
    onCancel?: () => void
    onOk?: () => void
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => ipc.invoke('start-download'),
  })

  const checkUpdate = async () => {
    setChecking(true)
    const result = await ipc.invoke('check-update')
    setProgressInfo({ percent: 0 })
    setChecking(false)
    setModalOpen(true)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      setUpdateAvailable(false)
      setUpdateError(result.error as ErrorType)
    }
  }

  const onUpdateCanAvailable = useCallback((_event: IpcRendererEvent, arg1: VersionInfo) => {
    setVersionInfo(arg1)
    setUpdateError(undefined)
    if (arg1.update) {
      setModalBtn((state) => ({
        ...state,
        cancelText: 'Cancel',
        okText: 'Update',
        onOk: () => ipc.invoke('start-download'),
      }))
      setUpdateAvailable(true)
    } else {
      setUpdateAvailable(false)
    }
  }, [ipc])

  const onUpdateError = useCallback((_event: IpcRendererEvent, arg1: ErrorType) => {
    setUpdateAvailable(false)
    setUpdateError(arg1)
  }, [])

  const onDownloadProgress = useCallback((_event: IpcRendererEvent, arg1: ProgressInfo) => {
    setProgressInfo(arg1)
  }, [])

  const onUpdateDownloaded = useCallback((_event: IpcRendererEvent, ..._args: unknown[]) => {
    setProgressInfo({ percent: 100 })
    setModalBtn((state) => ({
      ...state,
      cancelText: 'Later',
      okText: 'Install now',
      onOk: () => ipc.invoke('quit-and-install'),
    }))
  }, [ipc])

  useEffect(() => {
    ipc.on('update-can-available', onUpdateCanAvailable)
    ipc.on('update-error', onUpdateError)
    ipc.on('download-progress', onDownloadProgress)
    ipc.on('update-downloaded', onUpdateDownloaded)

    return () => {
      ipc.off('update-can-available', onUpdateCanAvailable)
      ipc.off('update-error', onUpdateError)
      ipc.off('download-progress', onDownloadProgress)
      ipc.off('update-downloaded', onUpdateDownloaded)
    }
  }, [ipc, onUpdateCanAvailable, onUpdateError, onDownloadProgress, onUpdateDownloaded])

  return (
    <>
      <Modal
        open={modalOpen}
        cancelText={modalBtn?.cancelText}
        okText={modalBtn?.okText}
        onCancel={modalBtn?.onCancel}
        onOk={modalBtn?.onOk}
        footer={updateAvailable ? /* hide footer */null : undefined}
      >
        <div className='modal-slot'>
          {updateError
            ? (
              <div>
                <p>Error downloading the latest version.</p>
                <p>{updateError.message}</p>
              </div>
            ) : updateAvailable
              ? (
                <div>
                  <div>The last version is: v{versionInfo?.newVersion}</div>
                  <div className='new-version__target'>v{versionInfo?.version} -&gt; v{versionInfo?.newVersion}</div>
                  <div className='update__progress'>
                    <div className='progress__title'>Update progress:</div>
                    <div className='progress__bar'>
                      <Progress percent={progressInfo?.percent} ></Progress>
                    </div>
                  </div>
                </div>
              )
              : (
                <div className='can-not-available'>{JSON.stringify(versionInfo ?? {}, null, 2)}</div>
              )}
        </div>
      </Modal>
      <button disabled={checking} onClick={checkUpdate}>
        {checking ? 'Checking...' : 'Check update'}
      </button>
    </>
  )
}

const Update = () => {
  const ipc = typeof window !== 'undefined' ? window.ipcRenderer : undefined
  if (!ipc) {
    return (
      <p className='read-the-docs' style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
        Running in the browser: use the <strong>Stanza</strong> desktop app for playback, IPC, and auto-updates.
      </p>
    )
  }
  return <UpdateWithIpc ipc={ipc} />
}

export default Update
