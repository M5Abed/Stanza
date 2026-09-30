import * as Sentry from '@sentry/electron/renderer'

/**
 * Initialize Sentry telemetry in the Renderer process.
 * Gracefully no-ops if SENTRY_DSN is not configured or in test environments.
 */
export function initRendererSentry(): void {
  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN || (process.env as any).VITE_SENTRY_DSN
  if (!dsn) {
    return
  }

  try {
    Sentry.init({
      dsn,
      environment: (import.meta as any).env?.MODE || 'production',
      tracesSampleRate: 0.1,
    })
    console.log('[Sentry] Renderer telemetry initialized')
  } catch (err) {
    console.warn('[Sentry] Failed to initialize renderer telemetry:', err)
  }
}
