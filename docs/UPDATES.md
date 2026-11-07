# Desktop installation and in-app updates

## First installation

Open [GitHub Releases](https://github.com/Huseyinhk61/DarkDesk/releases/latest) and download **DarkDesk-Setup-3.10.0.exe**, or a newer Setup release. Quit an existing instance from the system-tray **Quit** menu before installing. The NSIS wizard installs the app and a desktop shortcut; Node.js and a terminal are not required.

**Portable** is the alternative for running without installation. It does not replace itself through the in-app installer; download the next portable release manually.

Packages are currently unsigned. Windows may display a publisher or SmartScreen warning. Use the official release source and compare the download with the matching `SHA256SUMS.txt`:

```powershell
Get-FileHash .\DarkDesk-Setup-3.10.0.exe -Algorithm SHA256
```

## Public release access

The **3.4.2** configuration uses public GitHub Releases and requires **no personal GitHub access token**. Both the repository and its published release assets must be publicly accessible. Preparing this configuration does not itself change the GitHub repository's visibility. The owner can follow the [repository publishing guide](REPOSITORY.md).

If the repository is still private, a release is unpublished, or its update metadata is missing, DarkDesk reports an unavailable source instead of claiming that the app is up to date. Try again after publication or use the official download page. GitHub outages, rate limits, proxies, and firewall restrictions can also interrupt checks.

### Upgrading from the previous private-feed build

Install **3.4.2 or later manually once** if you are using 3.4.1 with its private-repository credential screen. Older installed code cannot acquire the new public-provider behavior simply because the repository becomes public. Settings, group assignments, and operation history are preserved.

If you previously saved a private-repository token, you can remove it from **Settings → Updates → Remove access** in 3.4.1 before upgrading. Public builds do not read, use, or transmit that historical encrypted token. Revoke the obsolete token in GitHub account settings if it is no longer needed. Never paste a token into a public issue or chat.

## Updating inside DarkDesk

Installed Windows Setup and Linux AppImage builds check 30 seconds after startup and every six hours while running, including in the system tray. Failed checks retry after 15 minutes. Returning to the app or resuming from sleep also checks when the previous check was at least 30 minutes ago; recent errors retain their 15-minute cooldown. Concurrent signals share one native check. A new version produces an in-app notice and, when the operating system allows it, a desktop notification. You can also check manually under **Automation & Settings → Updates**.

1. Select **Check for updates**.
2. Select **Download update** when a version is available. Progress appears in the panel.
3. After the download finishes, select **Restart and update**.

Downloads do not start automatically, and quitting does not silently install a package. Restart is blocked during file operations. Before installation, the app restores profile visibility, flushes widget drafts and analytics, and saves its state. A failed widget draft save stops the restart so the note can remain available for retry. `electron-updater` verifies the SHA-512 checksum. Network, metadata, download, and installation errors allow a retry.

Development builds, browser previews, Linux DEB installations, and portable Windows builds do not offer native in-app installation. Packaged Linux AppImages do support native updates through `latest-linux.yml`. They provide a link to the official download page instead. A browser preview never downloads or installs a real application update.

## When an update does not appear

Compare the **Current version** in Settings → Updates with the latest published GitHub release, then select **Check for updates**. Downloading source changes or pushing a review branch does not create a newer installer: the application version must increase and both packaging jobs must publish their assets successfully. A build failure is not a released update.

Use the installed Setup build for Windows in-app updates; Portable builds require downloading a new package. Old 3.4.1 private-feed builds need the one-time manual upgrade described above. A development window launched with npm also does not replace an installed application.

The sidebar update indicator stays visible after dismissing the notice. **What's new in this release** opens the official version page without starting a download. Downloads and restart remain explicit actions.

## Publishing a release

Increase the version in `package.json` and `package-lock.json`, then push to `main`. The Windows workflow runs tests, builds the Setup and Portable packages, and verifies the update metadata against the actual installer. It publishes:

- `DarkDesk-Setup-<version>.exe`
- `DarkDesk-Portable-<version>.exe`
- The setup `.blockmap`
- `latest.yml`
- Linux AppImage and DEB packages, plus `latest-linux.yml`
- `SHA256SUMS.txt`

The workflow creates a draft release, uploads all assets, then publishes it as the latest release. An already-published version is not overwritten; use a new version for another update. An interrupted draft can be retried. A `v<version>` tag must match the package version.

GitHub Actions uses its job-scoped `contents: write` permission for publication. No publishing token is bundled in the app. The runtime configuration in `shared/update-source.json` and the packaging source in `package.json` must agree; the release validator checks both and rejects embedded credentials.

Check the [Windows workflow](https://github.com/Huseyinhk61/DarkDesk/actions/workflows/windows.yml) and [published assets](https://github.com/Huseyinhk61/DarkDesk/releases) before sharing a download link. A local source push or cross-build does not establish that the remote workflow or release publication succeeded. Validation results and platform limitations are recorded in [VALIDATION.md](VALIDATION.md).
