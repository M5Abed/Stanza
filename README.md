# Stanza

Stanza is a modern, lightweight, and incredibly fast desktop music player powered by Electron and React. It harmonizes the vast library of **YouTube Music** with the high-fidelity metadata of **Spotify** to deliver a premium, uninterrupted audio streaming experience right to your desktop.

![Stanza Interface](https://img.shields.io/badge/App-Stanza-blueviolet?style=for-the-badge)

## 🚀 Features
- **Seamless Streaming:** Stream high-quality audio seamlessly from YouTube Music.
- **Spotify-Enhanced Metadata:** All search results, covers, and artist profiles are enriched with high-fidelity Spotify metadata.
- **Smart Cover Resolution:** Stanza automatically resolves and caches high-resolution Spotify album covers, falling back to YouTube only when necessary.
- **Dynamic Auto-Play Radio:** Get endless, highly-relevant recommendations perfectly matched to your listening session.
- **Lyrics Integration:** View synchronized lyrics on the fly, and manually edit or sync custom `.lrc` lyrics right in the app.
- **Playlists & Persistent Queue:** Fully functional queue management and custom playlists saved natively to your local machine.
- **Discord Rich Presence:** Show off what you're listening to natively on your Discord profile.
- **Top Songs & Advanced Discographies:** Deep pagination fetches over 50+ albums/singles gracefully, missing absolutely nothing.
- **Modern UI:** Designed with Framer Motion and TailwindCSS for a high-end, dynamic user experience.
- **Persistent Database:** Uses Prisma to cache player data and save your preferences securely.

---

## 📝 Update Logs

### Version 2.1
- **Performance & Optimization:** Significantly improved app performance and reduced background power consumption.
- **Floating Lyrics Engine:** Introduced a new detachable, floating lyrics window with top-pinning and resize capabilities.
- **YouTube Music Playlists:** Added native support for searching, viewing, and saving external YouTube Music playlists directly to your local library.
- **Enhanced Artist Resolution:** Resolved bugs causing duplicate artist profiles and fixed routing issues within featured artist sections.
- **Offline Mode Improvements:** Fixed the "Download All" track queue logic for local playlists, ensuring reliable batch downloading.
- **Playback Stability:** Refactored and stabilized the shuffle/random playback functionality for queue management.
- **UI & UX Refinements:** Reorganized the lyrics editor by moving the import/export controls to the edit screen, swapping the icons for clarity.
- **Mascot Integration:** Added the Pink Panther as a subtle watermark background to the main app interface.

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
- **[Spotify Web API](https://developer.spotify.com/documentation/web-api/)** - Primary source for high-fidelity track metadata and artist imagery.
- **[Howler.js](https://howlerjs.com/)** - Robust audio library for modern web.
- **[youtubei.js](https://github.com/LuanRT/YouTube.js)** & **[node-youtube-music](https://github.com/codyebberson/node-youtube-music)** - Unofficial YouTube APIs to scrape and stream music transparently.
- **[@distube/ytdl-core](https://github.com/distubejs/ytdl-core)** - High-fidelity media extraction.
- **[discord-rpc](https://github.com/discordjs/RPC)** - Native Discord integrations.
- **[Spotify Web API](https://developer.spotify.com/documentation/web-api/)** - Primary source for high-fidelity track metadata and artist imagery.

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
