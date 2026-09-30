# Changelog

All notable changes to the **Stanza** desktop music player will be documented in this file.

---

## [2.3.0] - 2026-08-27

### 🚀 Highlights & Architectural Improvements
- **Strict TypeScript Hardening**: Enabled `strict`, `noUnusedLocals`, and `noUnusedParameters` across all modules.
- **Testing Infrastructure**: Added Vitest unit test suite and Playwright end-to-end (E2E) testing framework.
- **Error Telemetry**: Integrated Sentry error monitoring for both Main and Renderer processes (opt-in via `SENTRY_DSN`).
- **Security Enhancements**: Sandboxed renderer windows, updated Content Security Policy (CSP), and enforced Zod runtime schema validation on all IPC channels.
- **Design System & Tokens**: Added centralized theme tokens (`src/theme.ts`) and reusable `GlassCard` component for polished glassmorphic UI.
- **Automated CI/CD**: Created GitHub Actions CI workflow covering linting, type-checking, unit testing, Playwright tests, and automated releases.
- **Developer Documentation**: Added developer guide (`DOCS/DEVELOPER.md`) and updated project documentation.
