# DarkDesk on Windows

## First installation from source

For a ready-to-run installer, see [Windows packages](#windows-packages). Node.js is only needed when running or building from source.

1. Install [Node.js 24 LTS](https://nodejs.org/). Close and reopen PowerShell after installation.
2. [Download the source ZIP](https://github.com/Huseyinhk61/DarkDesk/archive/refs/heads/main.zip) and select **Extract All**.
3. Find `package.json` inside `DarkDesk-main`. Type `powershell` in File Explorer’s address bar and press Enter.
4. Double-click `DarkDesk-Baslat.cmd` for a guided startup, or run `npm ci` in the terminal. Once it completes successfully, run `npm run desktop`.

If OneDrive manages your desktop, its folder may be under `C:\Users\...\OneDrive\Desktop` or a localized equivalent such as `Masaüstü`. DarkDesk uses the desktop location reported by the operating system for file operations. You can view this path in Settings. The desktop coverage panel also shows the common Windows desktop source and any access errors.

## Troubleshooting

### `git is not recognized`

Git is not installed or is missing from PATH. Use the ZIP method above, or install [Git for Windows](https://git-scm.com/downloads/win) and reopen your terminal.

### `ENOENT ... package.json` or a lockfile error from `npm ci`

The terminal is in the wrong folder. Run:

```powershell
Get-Location
Test-Path .\package.json
Test-Path .\package-lock.json
```

The last two commands must return `True`. If either returns `False`, change to the folder containing `package.json`. Extract the ZIP before running commands. If a `cd` command fails, correct the path before continuing with installation.

### PowerShell: `npm.ps1 cannot be loaded`

Use the `.cmd` command without changing the system execution policy:

```powershell
npm.cmd ci
npm.cmd run desktop
```

### Unsupported Node.js version

```powershell
node --version
npm --version
```

Node.js 24 LTS is recommended; the minimum supported version is 22.12.0. After upgrading Node.js, run `npm ci` again in the project folder to replace dependencies installed with an older version.

### Electron download or network error

The first installation needs access to the npm registry and Electron’s GitHub release files. Check your connection and your organization’s proxy and CA settings. Keep TLS certificate verification enabled. Once the connection works, run `npm ci` again in the project folder.

### `Port 5173 is already in use`

Stop the existing DarkDesk/Vite terminal with `Ctrl+C`, then run `npm run desktop` again. To avoid stopping another project’s development server, use `npm run desktop:preview`, which runs a production build without a development server.

### A file cannot be moved, or a OneDrive file is offline

Check that another application has not locked the file and that it is available locally. For OneDrive files, **Always keep on this device** can make them available offline. The preview skips conflicting destinations. If an operation was interrupted, review its history and undo completed steps before organizing again.

### Undo stops before completing

DarkDesk will not overwrite a destination that has changed or a new file at the original location. Inspect both locations in File Explorer. Back up your new files separately, resolve the conflict, and retry Undo. Deleting `history.json` does not restore files; keep it to preserve the recovery record.

## Updating a source checkout

For a Git checkout, preserve your local changes and run:

```powershell
git pull --ff-only
npm ci
npm run desktop
```

For a ZIP download, extract the newer ZIP into a different folder and repeat the installation steps. `npm ci` installs project dependencies; it does not move desktop files.

For updates downloaded and installed through DarkDesk, see the [update guide](UPDATES.md).

## Windows packages

Use the [Releases page](https://github.com/Huseyinhk61/DarkDesk/releases) for published installers. You can also download **Artifacts → DarkDesk-Windows** from a successful [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/workflows/windows.yml) workflow run. The archive contains Setup and Portable editions and `SHA256SUMS.txt`. Updates to `main` start the build automatically; the repository owner can also select **Run workflow**. A successful `main` build with a new version number publishes a release automatically. An existing published version is not overwritten.

Verify a downloaded installer:

```powershell
Get-FileHash .\DarkDesk-Setup-3.5.0.exe -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt` from the same release. Packages are currently unsigned, so Windows may show a publisher warning.

## Appearance, language, groups, and scanning

- Choose a theme, Turkish or English, and an icon pack under **Automation & Settings → Appearance & language**. Preferences stay on your device.
- Manage groups, subgroups, matching rules, and per-group folder colors under **Categories & Rules**. Search categories by name or path and preview keyword/regex matches before saving. Manual item assignments take priority over rules.
- **System Scanner** discovers desktop items and installed applications using Program Files, both Start Menu locations, and App Paths/Uninstall registry entries. It reports inaccessible locations and continues. It does not change the registry.
- Installed `.exe` files stay in their original locations. After confirmation, DarkDesk creates a `.lnk` in the category folder. Undo removes that shortcut.
- Choose one of three folder styles independently from the application theme. On Windows, new category folders use `desktop.ini` and `.darkdesk.ico`. Use **Apply to desktop folders** to update existing category folders; manually customized icon files are skipped. This action does not move files or replace application logos. See [folder appearance](FOLDER-APPEARANCE.md) for results, Explorer refresh, and undo behavior.
- Upgrades preserve move/copy preferences, category assignments, and undoable operation history. Changing the language does not rename existing folders.

## Profiles, Spotlight, and background operation

The [ecosystem guide](ECOSYSTEM.md) explains settings and limits. On new installations, the global launcher shortcut is **Alt+X**, and profile shortcuts are **Ctrl+Alt+1…4**. If another application or the operating system reserves a combination, change it in Settings.

The window’s X button hides DarkDesk in the system tray. To quit completely, choose **Quit** from its tray menu. Quitting restores visibility changes made by the active profile. After a forced shutdown, reopen DarkDesk and let recovery finish, or use **Show all again**. Profile hiding does not provide ACL or security isolation; Explorer’s hidden-file preference affects what remains visible.

Automations start disabled. Preview them, check their destinations, then enable and save. Downloads routing copies files by default; moving is a separate choice. Usage statistics only record launches through DarkDesk, not all Windows activity.

For icons, application details, and shortcut conflicts, see the [desktop interface guide](DESKTOP-UX.md).

For organization results and missing application logos, see the [organization and icon guide](ORGANIZATION.md).

For remote GitHub push errors, missing EXE releases, or update-feed 404 responses, see [GitHub troubleshooting](GITHUB-TROUBLESHOOTING.md).
