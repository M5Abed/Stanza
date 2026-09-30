import * as Sentry from '@sentry/electron/main'

/**
 * Initialize Sentry telemetry in the Main process.
 * Gracefully no-ops if SENTRY_DSN is not configured.
 */
export function initMainSentry(): void {
  const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN
  if (!dsn) {
    return
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    })
    console.log('[Sentry] Main process telemetry initialized')
  } catch (err) {
    console.warn('[Sentry] Failed to initialize main process telemetry:', err)
  }
}
