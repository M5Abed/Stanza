# Stanza

Stanza is a modern, lightweight, and incredibly fast desktop music player powered by Electron and React. It intercepts YouTube Music and Spotify APIs to seamlessly deliver a stunning, uninterrupted audio streaming experience right to your desktop.

![Stanza Interface](https://img.shields.io/badge/App-Stanza-blueviolet?style=for-the-badge)

## 🚀 Features
- **Seamless Streaming:** Stream high-quality audio seamlessly from YouTube Music.
- **Smart Spotify Search:** Search tracks and artists flawlessly. Stanza automatically resolves missing Spotify album covers natively via YouTube.
- **Dynamic Auto-Play Radio:** Get endless, highly-relevant recommendations perfectly matched to your listening session.
- **Lyrics Integration:** View synchronized lyrics on the fly, and manually edit or sync custom `.lrc` lyrics right in the app.
- **Playlists & Persistent Queue:** Fully functional queue management and custom playlists saved natively to your local machine.
- **Discord Rich Presence:** Show off what you're listening to natively on your Discord profile.
- **Top Songs & Advanced Discographies:** Deep pagination fetches over 50+ albums/singles gracefully, missing absolutely nothing.
- **Modern UI:** Designed with Framer Motion and TailwindCSS for a high-end, dynamic user experience.
- **Persistent Database:** Uses Prisma to cache player data and save your preferences securely.

---

## 💻 Tech Stack & Dependencies
Stanza is built using the latest web technologies compiled efficiently for desktop:

### Core Frameworks
- **[Electron](https://www.electronjs.org/)** - Desktop environment framework.
- **[React](https://react.dev/) / [Vite](https://vitejs.dev/)** - Lightning-fast UI rendering and bundling.
- **[TypeScript](https://www.typescriptlang.org/)** - End-to-end type safety.

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework.
- **[Framer Motion](https://www.framer.com/motion/)** - Beautiful, smooth micro-animations.
- **[Lucide React](https://lucide.dev/)** - Pixel-perfect iconography.

### Data & State
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Fast, un-opinionated state management.
- **[Prisma](https://www.prisma.io/)** - Next-generation ORM for reliable local caching.

### Audio & APIs
- **[Howler.js](https://howlerjs.com/)** - Robust audio library for modern web.
- **[youtubei.js](https://github.com/LuanRT/YouTube.js)** & **[node-youtube-music](https://github.com/codyebberson/node-youtube-music)** - Unofficial YouTube APIs to scrape and stream music transparently.
- **[@distube/ytdl-core](https://github.com/distubejs/ytdl-core)** - High-fidelity media extraction.
- **[discord-rpc](https://github.com/discordjs/RPC)** - Native Discord integrations.

---

## 📥 Installation

Because Stanza is packaged securely, you **do not** need to be a developer, and you don't need to install Node.js to use it!

### Requirements
- **OS:** Windows 10 or Windows 11 (64-bit)
- **Network:** An active internet connection (to stream music & fetch metadata).
- **Disk Space:** ~300MB of free space for the installation.

### Steps to Install
1. **Download the Installer:**
   Locate the official pre-compiled installer: `stanza_0.1.0.exe` (or the latest version provided).
2. **Run the Executable:**
   Double-click the `.exe` file.
   *(Note: If Windows SmartScreen displays an "Unrecognized app" prompt, click "More info" -> "Run anyway" since this app operates independently without a signed certificate).*
3. **Enjoy:**
   Stanza will unpack itself automatically. Once finished, the app will launch, and a shortcut will be added directly to your Desktop.

---

## 🛠️ For Developers (Manual Build)
If you wish to compile Stanza locally rather than using the `.exe`:

1. Clone the repository and navigate into the folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate the Prisma database client:
   ```bash
   npm run postinstall
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. *(Optional)* Compile to a strict `.exe` locally:
   ```bash
   npm run release
   ```
