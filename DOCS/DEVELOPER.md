# Stanza Developer Guide

Welcome to the **Stanza** developer documentation! This guide details the architecture, local development workflow, testing procedures, and security conventions for the project.

---

## 🏛️ Architecture Overview

Stanza is a modern desktop music application built with **Electron**, **Vite**, **React**, and **TypeScript**.

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
│  - Window Management & System Tray                          │
│  - Database & Prisma ORM (SQLite)                           │
│  - Audio Stream Extraction & Cache (yt-dlp)                 │
│  - Spotify Metadata & Lyrics Aggregator                     │
│  - Gemini AI Integration & Sentry Telemetry                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC Bridge (contextBridge)
┌──────────────────────────────▼──────────────────────────────┐
│                  Electron Preload Script                    │
│  - Type-safe IPC expose (`window.vibestream`)               │
└──────────────────────────────┬──────────────────────────────┘
                               │ Safe DOM Interface
┌──────────────────────────────▼──────────────────────────────┐
│                   React Renderer Process                    │
│  - Zustand State Management (Player, Playlists, Radio, UI)  │
│  - Tailwind CSS + Glassmorphism Theme                       │
│  - Howler.js Audio Bridge                                   │
│  - Floating Lyrics Window & Mini-player                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Prerequisites

- **Node.js**: v20+ recommended (LTS)
- **npm**: v10+
- **Platform**: Windows 10/11, macOS, or Linux

---

## 🚀 Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/M5Abed/Stanza.git
   cd Stanza
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in any optional API keys:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   GEMINI_API_KEY=your_gemini_api_key
   SENTRY_DSN=your_sentry_dsn # Optional error reporting
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Quality Assurance

Stanza includes automated test suites and linters:

### 1. Type Checking
```bash
npm run type-check
```

### 2. Unit Tests (Vitest)
```bash
npm test
```

### 3. E2E Tests (Playwright)
```bash
npm run test:e2e
```

### 4. Linting & Formatting
```bash
npm run lint
npm run format
```

---

## 📦 Building & Packaging

To create a production distribution package:

```bash
npm run release
```

Output installers will be generated under `release/v<version>/`.

---

## 🔒 Security Best Practices

- **Context Isolation**: Always enabled (`contextIsolation: true`).
- **Node Integration**: Always disabled in renderer (`nodeIntegration: false`).
- **Sandboxing**: Enabled across windows.
- **Content Security Policy (CSP)**: Defined in `index.html` to prevent XSS and unvetted network requests.
- **IPC Validation**: All IPC payloads must be validated using Zod schemas located in `shared/ipc-schemas.ts`.
