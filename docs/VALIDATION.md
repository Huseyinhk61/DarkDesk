# DarkDesk validation report

## 3.5.1 — runtime-state and Undo synchronization

Date: November 5, 2026.

- **193 service/model/settings tests passed** without failures or skips. The added regression verifies that asynchronous native status collection reports current operation activity.
- A deterministic browser regression reproduced the stale-status failure before the fix and passed afterward. It checks that a delayed busy snapshot cannot replace a newer idle event, and that UI Undo restores all files.
- **83 Chromium scenarios passed** in the final local run, including the new runtime-event regression. Production build and the isolated source Electron smoke test passed. The native test now waits for idle controls and preserves diagnostic state on an Undo failure.
- The Linux unpacked ASAR passed the same native smoke test. Its version is 3.5.1; native/shared modules and all renderer assets match the current source, and all 360 folder ICOs are present.
- **Published and verified:** the [Windows Installer run](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41983794758) passed native Windows IPC, Setup/Portable packaging, release validation, checksums, and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41983794941) passed on Windows/Linux; its browser job reports **83 passed**.
- [Release v3.5.1](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.5.1) is public. Anonymous requests for Setup, Portable, the blockmap, and the update feed returned HTTP 200. The feed reports 3.5.1 and its installer size matches the published file.

Official release files (use this release's `SHA256SUMS.txt`):

- Setup: 134,389,609 bytes; SHA-256 `7954d58391e162ff329d3ad7ca903af84bc06e9dc348f3ee3178be464cdd43a3`.
- Portable: 121,043,696 bytes; SHA-256 `91d7cac24338bfe9d93abc02799167d6e907bd4ce88388f41d859a136849def3`.

The Windows runner validates native APIs and folder metadata. Interactive Explorer repaint, physical hotkeys while gaming, a GUI installation, and an old-to-new upgrade on the user's computer remain outside these automated checks.

## 3.5.0 — folder appearance and smarter groups

Date: November 5, 2026. Local environment: Linux, Node.js 24, Electron 45, Chromium, and Xvfb.

- **192 service/model/settings tests passed**, without failures or skips. New cases cover 360 bundled folder ICOs, ownership of existing folder metadata, custom-icon preservation, interrupted appearance changes, exclusive publication on cloud-backed filesystems, attribute recovery, and undo after a later appearance change. Appearance validation also covers old settings and untrusted folder-theme cache values.
- **82 Chromium scenarios passed**, including folder-style and color persistence, localized built-in category labels after color editing, subgroup totals/filtering/drag-and-drop, remembered group ordering, rule previews, uncertain-assignment review, and theme-aware scrollbars with fixed window controls.
- The production build passed. Route-level loading keeps the initial JavaScript chunk below 500 kB. Prettier and whitespace checks passed.
- The real Electron IPC smoke test passed from source and from the Linux unpacked ASAR, using disposable Desktop, common Desktop, Downloads, and application directories. It exercises file move/undo, scanner switching, icons, launcher, profiles, automation, and the folder-appearance IPC. Linux correctly reports native Windows folder customization as unsupported.
- The unpacked package contains all 360 new ICOs. Packaged service modules, shared grouping/folder modules, renderer assets, and version were compared with the source tree.
- English screenshots were captured from the actual browser demo. They show sample data; browser mode does not extract native app logos or modify real folders.

The [Windows Installer run](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41982921144) passed and published [v3.5.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.5.0). Its native test passed. A separate Windows CI run exposed an intermittent UI Undo state race, subsequently reproduced and fixed in 3.5.1. The synchronized browser checks passed all 82 scenarios on GitHub. Interactive Explorer redraw and a real old-to-new installation upgrade were not tested here.

## 3.4.3 — common desktop coverage and app categorization

**Published and verified:** [Windows Installer run](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41824868352) succeeded, including real Windows native IPC tests, EXE packaging, metadata validation and release publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41826147065) also succeeded on Windows/Linux; its browser job reports **73 passed**. [Release v3.4.3](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.4.3) is public. Anonymous Setup/Portable requests and the update feed returned HTTP 200; the Setup size matches `latest.yml`.

Official release files (use that release's `SHA256SUMS.txt`):

- Setup: 128,251,506 bytes; SHA-256 `2cbc808ab2c425ec98612538e49f02aa483b29276c805df695ab9ae3631e2a79`.
- Portable: 114,965,879 bytes; SHA-256 `8fa2d70617fd74b42ee225d58287ecfb0c5c3ad4cee65dee4414980a4c1c9814`.

The local cross-build evidence below has different packaging hashes; it is separate from the official Windows-runner assets. A desktop GUI installation and old-to-new upgrade on the user's own machine have not been tested here.

Date: November 4, 2026. Linux, Node.js 24, Electron 45 and Chromium.

- **174 service/model tests passed** without failures or skips. New real-filesystem cases cover common-desktop IDs and name collisions, the seven reported applications, shared move/copy/undo, denied source removal while later items continue, missing sources, substituted directory symlinks, exclusion from unattended archiving, and bounded UTF-8/UTF-16 game shortcuts.
- **73 browser scenarios passed**, including six new coverage, permission-state, copy-mode and shared-preview scenarios. Production build passed; formatting and whitespace checks passed.
- The native Electron smoke test passed from source and from the final Windows ASAR using Linux Electron on an isolated desktop, including a separately injected common desktop, game categorization, real file movement and undo. Tests substitute temporary known-folder paths rather than accessing the host's real common desktop.
- Windows Setup and Portable 3.4.3 cross-builds passed. Both passed NSIS archive integrity checks. Release validation verified installer size/SHA-512, the blockmap and credential-free public update source. These are not live Windows installation results.
- The remote push that previously returned `commit_refs` errors succeeded on a later ordinary retry. Remote Windows unit tests subsequently passed. The native step exposed an 8.3 versus long-path comparison; both shortcut target and icon checks now compare real file paths. Native failure annotations expose any remaining diagnostic. A local pass does not establish that a remote release is published.

- DarkDesk-Setup-3.4.3.exe: 128,252,130 bytes; SHA-256 `64e434dc6b566cee1a48a6f515e458beed3aae1e3bfb69d457f3844dfdee2400`.
- DarkDesk-Portable-3.4.3.exe: 114,619,880 bytes; SHA-256 `ffd11869e2e6626d79b7901c0d8abb68178d80828640df82754e3d9fb87e2f6c`.

## 3.4.2 — public updates and English project page

Date: November 4, 2026. Linux, Node.js 24, Electron 45, Chromium, and Xvfb.

- **163** service/model/settings tests passed; no failures or skips. Seven public-provider cases cover unauthenticated checks/downloads, rejection of credential mutation, unsupported platforms, metadata errors, HTTP 401/403 messages, sanitized state, and retry behavior. The historical private-provider tests still pass.
- Production build passed; **67** Chromium interface scenarios passed, including the public update panel without a credential form.
- The native Electron smoke test passed against the final Windows package's ASAR using Linux Electron and disposable desktop directories. Its public source, current updater module, renderer, and version were compared with the source tree. This does not run the Windows executable.
- Setup and Portable **3.4.2** were cross-built successfully. Both passed the `7zz t` NSIS archive integrity check. Release metadata validation passed for the installer size/SHA-512, blockmap, and matching public update-source configuration with no embedded token. SHA-256 checksums were generated for the four current release assets.
- English screenshots were captured from the real browser demo. Local Markdown links, workflow/issue YAML syntax, Prettier formatting, and whitespace checks passed.

The GitHub repository-administration request to change visibility returned **Forbidden**. The source is prepared for public releases; this report does not claim that the repository is already public or that remote release publication succeeded. Live Windows installation, upgrades, and notification delivery remain unverified in this Linux environment. Packages are unsigned.

- DarkDesk-Setup-3.4.2.exe: 128,246,641 bytes; SHA-256 `6a2938cb8a5bd7ddbb7ca088d7a94faeed65e45a529b9d57eb196cfd3750f596`.
- DarkDesk-Portable-3.4.2.exe: 114,613,621 bytes; SHA-256 `4e994948cb3210c3886317daf90c33468780e53170c4967c5ce76478bfb42d38`.

## Historical 3.4.1 run

The results below record the completed **3.4.1** validation run. They are historical evidence for that build; they do not establish validation or publication of a later version.

Date: November 4, 2026. Local environment: Linux, Node.js 24, Electron 45, Chromium, and Xvfb.

| Check                            | Result                                                                                                                                      |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                       | 156 service, model, and settings tests passed; no failures or skips.                                                                        |
| `npm run build`                  | Production React/Tailwind build passed.                                                                                                     |
| `npm run test:e2e`               | 67 Chromium scenarios passed.                                                                                                               |
| `npm run test:desktop`           | Isolated real Electron/IPC test passed.                                                                                                     |
| Linux `electron-builder --dir`   | Application directory and ASAR built. This check alone does not produce an AppImage or a Windows EXE.                                       |
| Electron test from packaged ASAR | Shared ESM/JSON modules, preload, scanner, icon assets, and renderer ran from the package.                                                  |
| Package contents                 | Native icons, runtime/profile/automation modules, translations, and the RE2 regex dependency were present; test entry points were excluded. |
| `npm audit --omit=dev`           | No known vulnerabilities were reported in production dependencies.                                                                          |

## 3.4.1 update-access and EXE validation

Seven access-store tests and eight private-update adapter tests cover encrypted reading/writing, corrupt files, symbolic links, blocking requests without credentials, credential replacement/removal, required rechecks, and keeping credentials out of status objects. Two UI tests verify that the password field clears after saving and that removing access disables checks. Windows encryption uses Electron’s `safeStorage` API backed by DPAPI. This Linux session did not make GitHub requests with a real user credential or run a Windows upgrade. See the [update guide](UPDATES.md) for current distribution setup.

Windows Setup and Portable **3.4.1** EXEs were cross-built on Linux. The official electron-builder `UninstallerReader` helper handled the intermediate NSIS uninstaller generator; this required no application production-source changes. Both EXEs passed the `7zz t` NSIS archive integrity check. `verify-windows-release.cjs` verified the version, size, SHA-512 values, blockmap, and credential-free `private: true` update configuration in those artifacts. These checks do not replace a live Windows installation test.

- Setup: 128,245,857 bytes; SHA-256 `bb1cbafffc41adc0b32d647f5f7065ea64c4f4f483ad9f41c307c843667f2af1`.
- Portable: 114,613,163 bytes; SHA-256 `b3fca2637eb6880192259afa264489990b07ade14064318994008cb38b7d4e47`.

## 3.4 coverage

Scanner tests select and scan each of the three sources. Desktop, Downloads, and installed-application collections remain distinct when switching between them. Tests cover filter resets, source read failures, and stale-result protection. The native Electron test repeats these transitions with real temporary Desktop, Downloads, and Program Files directories.

Appearance and group-service tests cover new theme/font/icon preferences, 60 ICO assets, schema 4 group migration, respecting deleted groups, and undoing older history. They also verify the new Alt+X default and preservation of saved custom shortcuts.

The update service was tested with an injected `electron-updater` adapter: concurrent requests, one notification per version, explicit downloads, checksum errors, unavailable feeds, installation ordering, deferral during file operations, and recovery after installation launch failures. UI tests cover downloading, progress, restart, and Portable limitations. **No real Windows upgrade from an older version to a newer version was performed in this Linux session.** GitHub Release visibility and remote workflow results could not be verified in this environment; website/API requests returned 404/403.

## 3.3 coverage

Filesystem regression tests inject folder-icon/attribute failures, timestamp failures, critical journal failures, and denied source deletion into move/undo operations on real temporary files. A corrupt destination checksum test prevents false success counts. Tests verify that new shortcuts preserve the source executable’s icon and arguments, and that copying `.lnk`/`.url` files does not alter them.

The Windows icon service uses fixed PowerShell scripts and Windows resource APIs. Local tests verify custom-icon priority, UTF-16 `.url` reading, source fingerprints, PNG validation, and bounded process communication through injected adapters. **Live Windows icon extraction was not run in this Linux session.** The Windows Electron branch in GitHub Actions includes a `windows-native` PNG-extraction check using a `.lnk` targeting the real Electron executable. This report does not establish that the remote workflow passed.

The 3.3 purpose catalog contained 82 known applications. Tests cover common launchers, shortcut labels, false document matches, manual-rule priority, and uncertainty labels. Descriptions are generated locally; a filename imitating an application does not verify its identity or publisher.

UI scenarios verify the start of the item collection at 1366×768, 130% text in small windows, the opaque launcher, description panel, manual icon refresh, and operation results with actual action counts. Real Electron and ASAR tests also check move/undo and the result panel on an isolated desktop.

## 3.2 coverage

The Vite watcher excludes distribution outputs, test reports, and documentation. Writing those files no longer causes a development-view reset.

Service tests verify persistence for seven palettes and System Theme, adding appearance defaults to older settings, rejecting invalid appearance values, and contrast of primary text tokens against base surfaces. This does not certify every screen against an accessibility standard.

Window-geometry tests cover removed monitors, displays with negative coordinates, small work areas, corrupt records, and ordered persistent writes. The real Electron test checks window-state IPC and the saved file at exit; physically disconnecting a monitor was not tested.

UI scenarios cover the new palettes, live OS theme changes, 130% text, reduced motion, compact density, preserving unsaved operation preferences, the help screen, and skip-to-content navigation. Dialog tests verify cursor preservation while typing, background isolation, error announcements inside the dialog, focus return to the opening control, and Spotlight combobox navigation. Automated checks do not replace testing with screen-reader users.

## 3.1 coverage

Service tests cover icon source/target fallback, trusted-index checks, concurrent requests during metadata-cache eviction, chunked UTF-8 and stdout reading after process exit, and rollback on shortcut conflicts. UI tests use a simulated native PNG service to verify icon priority, keyboard capture/cancellation, information-panel errors/retries/focus return, and the fixed window layout.

The real Electron test verifies a PNG from `app.getFileIcon`, or `null` when unavailable, filesystem metadata, rejection of detail requests outside the trusted index, and shortcut capture/resume. Registered keys are checked with Electron’s `globalShortcut.isRegistered`. This is not a physical keypress test while another application or game has focus. Windows publisher/description retrieval is verified with injected version information and fixed PowerShell process tests; live Windows executable resources were not read in this session.

## Verified behavior

- Desktop scanning, move/copy, content verification, destination conflicts, and undo.
- Recovery of interrupted move/undo records while protecting existing or modified files.
- Migration of older numeric category preferences to stable IDs and undoing older history.
- Subfolder creation; validation of cycles, reserved Windows names, and path traversal; undo after category deletion.
- Deep-scan roots, registered locations, helper-file filtering, target-and-arguments deduplication, access warnings, limits, and cancellation.
- Creating `.desktop` shortcuts without changing the installed application, undoing those shortcuts, and preserving original application content.
- Seven original palettes and System Theme, two languages, icon-pack/item-icon persistence, custom categories and rules, search, and filtering, with expanded 3.4 appearance coverage described above.
- Overflow checks at 390 px width, including the English light theme; keyboard search, dialog focus, and undoable notifications.
- Matching translation keys and placeholders in Turkish and English dictionaries.
- Profile visibility, preserving previously hidden items, profile switching, and restoration at exit, including real Linux `.hidden` operations.
- Content verification for an approved move plan while profile visibility changes.
- Spotlight keyboard navigation, fuzzy search, commands, and rejection of paths outside the trusted index.
- Safe regex rules, subcategories, noise filters, local tagging suggestions, and archive suggestions based only on DarkDesk launch history.
- Optional archive/Downloads automation, avoiding repeated movement of the same version after undo, and drag-and-drop category assignment.
- Profile/restoration, Spotlight IPC, tray hiding, archive, and Downloads flows in real Electron and packaged ASAR. The test replaces application launching with a recording adapter; it does not start external programs.

## Limits of platform validation

This session did not run Windows. The Windows registry source was tested with injected fixtures and the fixed PowerShell command’s paths, rather than the user’s live registry. Windows Hidden attributes and Explorer refresh, global shortcuts on a live Windows desktop, `.lnk` creation, Explorer folder icons via `desktop.ini`, and EXE installation were not validated on real Windows here. Whether a Linux desktop manager visually honors `.hidden` also depends on the environment. Manually dragging files from the operating system and opening external applications are outside these tests.

The GitHub Actions Windows runner is configured to run service and real Electron tests. The Windows branch additionally checks generated `.lnk` targets/icons and `desktop.ini` contents. Local success does not prove the remote jobs passed; check [Actions](https://github.com/Huseyinhk61/DarkDesk/actions).

A full development-toolchain audit reports moderate advisories in the packager’s transitive development dependencies. The production-dependency audit is separate; passing tests do not establish the absence of every security vulnerability.
