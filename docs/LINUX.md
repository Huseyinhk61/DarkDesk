# Linux desktop support

DarkDesk provides x86-64 **AppImage** and **DEB** packages. Use a current Linux desktop (Ubuntu 22.04+, Debian 12+, or equivalent). ARM packages are not currently published.

## Install

On Ubuntu/Debian, download `DarkDesk-3.12.0-amd64.deb` from GitHub Releases and install with:

```sh
sudo apt install ./DarkDesk-3.12.0-amd64.deb
```

The package installs DarkDesk under `/opt/DarkDesk` and adds a launcher to the application menu. It declares GIO and Electron desktop dependencies.

For another compatible x86-64 desktop, download `DarkDesk-3.12.0-x86_64.AppImage`:

```sh
chmod +x DarkDesk-3.12.0-x86_64.AppImage
./DarkDesk-3.12.0-x86_64.AppImage
```

AppImages require the distribution’s FUSE compatibility support. Use the DEB package on Ubuntu/Debian if mounting AppImages is unavailable; sandbox and TLS verification do not need to be disabled. Verify downloads against the release’s SHA256SUMS.txt.

## Features

- Organize Desktop and Downloads files with preview, operation receipts and Undo. Installed programs remain in place; category folders receive launchers.
- Index system/user desktop entries, Flatpak exports, Snap application entries, `/opt` and `~/Applications`. Read localized Name/Comment values without parsing or executing Exec while scanning. Hidden service entries are filtered. Flatpak export symlinks are resolved only into known Flatpak application roots.
- Launch desktop entries through GIO; run executable AppImages directly without a shell. Launch failures do not count as successful dispatches.
- Use command/application favorites, the calculator, unit and currency conversion, theme/font settings and interactive floating widgets.
- AppImage installs support in-app update checks and installation through the public Linux update feed. Update DEB installs manually with the new DEB package.

Desktop-layer widgets fall back to ordinary floating windows on Linux. Global shortcut availability varies with the desktop and Wayland restrictions. Windows folder icon styling and startup controls remain Windows-specific; foreground analytics remains Windows/macOS-specific. Linux focus visibility depends on the file manager’s support for `.hidden` metadata.

## Currency connectivity

The native app uses Electron’s network stack and operating-system proxy configuration. Type `50 USD to TRY`, or `100 EUR`, and use **Refresh rates** to request a fresh snapshot. Published reference dates are shown; an offline fallback is labeled and expires after seven days. No API key is needed, and the typed amount or filenames are not sent to the provider.

The Codex cloud environment has its own network allowlist, separate from the installed app. The `api.frankfurter.dev` allowlist addition was saved as a configuration draft. The environment owner must review/save it in Environment Settings and publish the environment before live-provider validation in that cloud instance can proceed. Saving a draft alone does not change runtime networking.

## Native system actions (3.12)

Quick Launcher detects installed, functioning providers when DarkDesk starts. Audio supports PipeWire (`wpctl`) or PulseAudio (`pactl`); locking uses your logind session; Wi-Fi uses NetworkManager (`nmcli`); screenshots use GNOME Screenshot or Spectacle in a graphical session. Commands are shown as unavailable when their provider/session is missing. Desktop permissions still apply. Linux shutdown, recycle-bin clearing, Night Light and cleanup are not claimed as supported actions by these adapters.

Weather uses MET Norway (`api.met.no`) with a manually selected location and no API key. Cloud validation requires this hostname and `api.frankfurter.dev` to be allowed in the cloud environment; those restrictions do not alter the installed app's own network configuration.
