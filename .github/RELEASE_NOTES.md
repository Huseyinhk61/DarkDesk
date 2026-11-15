## DarkDesk 3.13.1 — Weather at a glance

### Download

- **DarkDesk-Setup-3.13.1.exe** — recommended Windows installation, with in-app updates.
- **DarkDesk-Portable-3.13.1.exe** — Windows without installation; update manually.
- **DarkDesk-3.13.1-x86_64.AppImage** — Linux AppImage, with AppImage updates.
- **DarkDesk-3.13.1-amd64.deb** — Ubuntu/Debian package; update manually.
- **SHA256SUMS.txt** — package and update metadata checksums.

You do not need Node.js or Git. Download an installer above; GitHub's automatic **Source code (zip)** is for developers. See the [English getting-started guide](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/QUICK_START.md) or [Türkçe kullanım rehberi](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/KULLANIM.md).

### More useful weather

Open **Desktop Widgets → Weather**, select a city and activate the panel. Switch between **Now**, **Hourly**, **5 days** and **Details** without scrolling. See upcoming temperatures and rain, estimated feels-like temperature, wind gusts/direction, pressure, cloud cover and rain probability when supplied. Hourly forecasts have previous/next controls. The clock and daily forecast follow your chosen city's time zone; custom coordinates have an editable time zone.

A recent reading stays visible during refresh failures and is marked cached. Old readings expire after an hour. Forecasts are MET Norway model predictions, not live weather-station measurements. Daily ranges are calculated from available forecast samples; today's range is partial. No API key or subscription is needed. Only manually selected coordinates are sent to the weather provider. [Weather guide and attribution](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/WEATHER.md).

### Reliable quick notes

Quick notes also save when the editor loses focus and when the preview page closes. Immediate reloads preserve text still waiting for the autosave timer. A frozen-timer regression covers this case; native widget closing retains its awaited IPC flush.

### Easier help and setup

Help now includes user-guide/privacy/report links, a visible Default Mode shortcut and **Copy support information**. The copied text includes version, platform, architecture, update channel, language and theme; it excludes file paths, notes and credentials. The GitHub page now focuses on installation and everyday use. The Windows source launcher and Electron download repair respect configured Node proxies; the development guide includes proxy setup for an initial install.

### Updating

Installed Windows and Linux AppImage users can check **Automation & Settings → Updates**. Portable and DEB users replace the app manually. Preferences remain local. Microsoft Store builds use Store-managed updates.

### Publisher files

The separate [Store submission release](https://github.com/Huseyinhk61/DarkDesk/releases/tag/store-v3.13.1) provides the unsigned AppX and verified ZIP for Partner Center. These are publisher submission files; Microsoft certification and Store listing approval are separate steps. Use the stable Setup EXE for normal Windows installation.
