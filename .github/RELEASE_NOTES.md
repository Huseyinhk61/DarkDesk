## Install DarkDesk

Choose a Windows x64 download under **Assets**:

- **`DarkDesk-Setup-3.7.0.exe`** — recommended for everyday use; includes in-app updates.
- **`DarkDesk-Portable-3.7.0.exe`** — runs without installation; download a new package to update it.
- **SHA256SUMS.txt** — checksums for verifying the downloads.

Quit an older DarkDesk instance from its system-tray menu before installing. Node.js is not required. Packages are currently unsigned, so Windows may display a publisher warning.

## What's new in 3.7.0

- **Descriptions with context:** Windows File Description metadata for supported executables and shortcut targets, an offline dictionary expanded to 114 apps, and useful filename/type fallbacks. Advanced IP Scanner, BCUninstaller, and Any Command are included. Write a manual description in app details; badges show each explanation's source.
- **Interactive desktop widgets:** separate transparent CPU/RAM, sticky-note, and to-do windows, with saved content, enabled state, and positions. Native Windows/macOS desktop placement has an explicit floating fallback; Linux uses floating windows. Browser preview offers inline notes/tasks without inventing system metrics.
- **Windows startup manager:** inspect Run and Startup-folder entries, then disable or re-enable supported current-user entries through StartupApproved flags. Original commands and files remain intact; machine-wide entries are read-only. Changes apply to future sign-ins, not currently running apps.
- **Opt-in focus analytics:** a local dashboard for sampled foreground time, eligible open-app time, and time in workspace profiles. Collection starts disabled, samples about every 15 seconds on Windows/macOS, excludes idle/locked/suspended periods, and retains aggregates for 90 days. Open-app time can overlap and is not total process lifetime. Clear history from the same screen.
- **Discoverable launcher prefixes:** `?`, whitespace, or F1 opens a guide to `g`, `yt`, `gh`, `calc`, and `sys`. `calc 120 * 45` copies a local result; `sys lock` routes to the native lock action. Successful local commands can appear as frequent suggestions. Shutdown and recycle-bin actions retain their separate confirmation.
- **More reachable navigation:** widget, startup, and analytics destinations join the fixed sidebar, with independent scrolling when the window is short or text is enlarged.

All modules retain English/Turkish localization. Existing **Alt+X** launch access, three scan sources, 25 smart groups, custom rules, original app icons, reversible file organization, focus profiles, and verified organized-file launcher recovery remain available. Appearance includes 13 palettes plus System Theme, 4 font-family choices, 5 icon packs, and custom HEX/gradient folder artwork.

Application descriptions, widget notes/tasks, and analytics remain local. Metadata and dictionary filename matches do not independently verify an app's identity or publisher. Startup control is currently Windows-only; native analytics is Windows/macOS-only. macOS deep application scanning, profile visibility, and signed/notarized distribution are not included.

Installed Windows builds use the public GitHub update feed without a personal token. You choose when to download and restart. Portable users download the new EXE manually. Older 3.4.1 private-feed installations require a one-time manual installation of a current Setup release.

Read the [productivity guide](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/PRODUCTIVITY.md), [launcher guide](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/LAUNCHER.md), [app metadata guide](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/DESKTOP-UX.md), and [validation report](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/VALIDATION.md) for behavior, platform limits, and completed checks.
