# Stanza on Omarchy / Arch Linux

This note records the Linux-specific change and the commands used to build, install, and launch Stanza on Omarchy. The Windows target and Windows-specific behavior remain unchanged.

## Linux compatibility changes

In `electron/main/index.ts`:

- Electron hardware acceleration is disabled on Linux before the app is ready. The original crash was in Mesa's `libgallium` during EGL/DRI fence creation in Stanza's GPU subprocess. Linux software rendering avoids that hardware GPU path; Stanza's audio playback does not require GPU acceleration.
- The BrowserWindow icon is selected by platform: Windows continues to use `icon.ico`; Linux and macOS use `icon.png`.

These platform checks do not change the Windows installer configuration or the Windows yt-dlp resource.

## Requirements

- Omarchy / Arch Linux, x86-64
- Node.js and npm to build from source
- Project dependencies installed with `npm install`
- `yt-dlp` available on `PATH` at runtime; on Arch, install it with `sudo pacman -S yt-dlp`

The AppImage does not bundle `yt-dlp`; Stanza uses the system package on Linux. This machine already had `yt-dlp` 2026.08.19-1 installed.

## Build the Linux AppImage

From the Stanza repository root:

```bash
npm install
npm run release:linux
```

The script type-checks and builds the renderer and Electron main/preload code, then packages the Linux AppImage. By default, electron-builder writes it under `release/v<version>/`.

To build to a separate directory and preserve existing release artifacts:

```bash
npm run release:linux -- --config.directories.output="$HOME/Work/Stanza-linux-build"
```

For this run, the output was:

```text
/home/abed/Work/Stanza-linux-build/Stanza_2.3.0_linux.AppImage
```

## Install and add an application-menu launcher

The installed Linux-only files are:

```text
~/Applications/Stanza/Stanza.AppImage
~/Applications/Stanza/icon.png
~/.local/share/applications/com.mohamedabed.stanza.desktop
```

Equivalent install commands for a newly built AppImage are:

```bash
mkdir -p "$HOME/Applications/Stanza" "$HOME/.local/share/applications"
install -m 755 /path/to/Stanza_<version>_linux.AppImage \
  "$HOME/Applications/Stanza/Stanza.AppImage"
install -m 644 public/icon.png "$HOME/Applications/Stanza/icon.png"
cat > "$HOME/.local/share/applications/com.mohamedabed.stanza.desktop" <<EOF_DESKTOP
[Desktop Entry]
Type=Application
Name=Stanza
Comment=Desktop music player
Exec=$HOME/Applications/Stanza/Stanza.AppImage
Icon=$HOME/Applications/Stanza/icon.png
Terminal=false
Categories=AudioVideo;Audio;Player;
StartupWMClass=Stanza
EOF_DESKTOP
chmod 644 "$HOME/.local/share/applications/com.mohamedabed.stanza.desktop"
```

After installation, launch **Stanza** from the application launcher, or run:

```bash
"$HOME/Applications/Stanza/Stanza.AppImage"
```

## Verification from this run

- `npm run release:linux` completed successfully, including TypeScript and Vite production builds and AppImage packaging.
- The rebuilt AppImage was installed under `~/Applications/Stanza/`; its SHA-256 matched the build output.
- Hyprland showed the Stanza window and the Electron GPU process used ANGLE/SwiftShader. No new Stanza core dump was recorded after launch.
- The Windows build was not rebuilt or modified as part of this Linux installation.
