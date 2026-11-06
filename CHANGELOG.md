# Changelog

## 3.8.2 — November 6, 2026

- Publish the previously reviewed production-polish changes with a new application version so installed builds can actually discover the update.
- Retry failed update checks after 15 minutes, check on resume/return after a cooldown, and retain normal six-hour background checks without automatic downloads.
- Keep a navigation indicator after dismissing an update notice and add official per-version release notes. Protect new update events from a delayed initial-status error.

- Persist a category-specific Gradient/Solid/Outline override or follow the global folder style. Share appearance signatures and style resolution across React previews, native ICO generation and synchronization records.
- Report skipped unsafe/changed folder updates alongside apply failures while preserving independent Explorer customizations.
- Accept `USD to TRY` and `EUR` as one-unit currency queries; retain explicit amounts, unit conversions, dated reference rates and offline/error labeling.
- Guide first-time users through pinning both command and application favorites, preserve AI grouping/manual routing, and prevent stationary-pointer hover events from stealing keyboard selection when results move.
- Give scanner cards a readable minimum column width and wrapped titles. Collapse startup commands into keyboard-accessible details with fully wrapped paths, aligned controls and large-text support.

## 3.8.1 — November 6, 2026

- Publish verified Linux AppImage/DEB packages alongside Windows installers; add an AppImage update feed and desktop-menu association.
- Route native currency requests through Electron networking, add manual refresh, bound browser/native responses and correct cache status.
- Read Linux desktop metadata without executing it; discover Flatpak/Snap/AppImage sources and launch entries through GIO with failure reporting.
- Fix null metadata handling for Linux descriptions and preserve executable launcher copies.

## 3.8.0 — November 6, 2026

- Add persistent application and command favorites with dedicated launcher views and keyboard shortcuts.
- Add currency conversion using dated institutional reference rates, one-hour caching and explicit offline/error states.
- Introduce the AI root and four subgroups with one-time settings migration and 20 additional bilingual app descriptions.
- Synchronize folder palette accents across cards and selectors and report pending physical icon refreshes.
- Improve scanner text wrapping, card footer alignment and palette keyboard navigation.

## 3.7.1 — November 5, 2026

- Compact desktop widgets with persistent collapse/expand state, per-core CPU samples and a RAM percentage bar. Preserve notes, tasks and expanded bounds across collapse and restart.
- Stop widget content saves from reloading and overwriting appearance preferences; native windows receive dedicated settings events.
- Assign immutable content-addressed Explorer icon resource paths so changed folder colors and styles invalidate the previous icon identity. Preserve ownership checks, custom metadata and Undo.
- Improve custom-color accent contrast, compact spacing, keyboard controls and wrapping.

## 3.7.0 — November 5, 2026

- Read Windows executable and resolved shortcut descriptions lazily, expand the offline app dictionary to 114 entries, and let users save local descriptions. Explain whether a description comes from metadata, the dictionary, or a filename estimate.
- Add independent, draggable CPU/RAM, notes and task widgets with persisted content and positions. Attach interactive widgets above Windows/macOS desktop icons when the native adapter is available; expose a floating fallback.
- Add reversible Windows current-user startup management through StartupApproved flags; preserve commands, shortcuts and original approval values. Machine entries stay read-only.
- Add opt-in, local productivity analytics with separate sampled foreground, open-app and workspace profile durations, local-day charts, idle/lock/suspend exclusions and 90-day retention.
- Add an interactive Quick Launcher prefix guide, explicit calc/sys prefixes and suggestions from successfully dispatched commands.
- Keep navigation reachable on smaller desktop windows while retaining existing folder colors, gradients and Undo protections.

## 3.6.1 — November 5, 2026

- Keep organized files available in Quick Launcher using their verified operation history, stable item IDs, and current managed-folder paths. Favorites and observed launch counts survive moves, Undo, and application restarts.
- Prefer available original files and installed executables, remove stale or deleted results, and reject changed managed outputs and substituted directory symlinks. Recovery stays within recorded Desktop destinations; it does not recursively index arbitrary folders.
- Cache verified output checksums with bounded file fingerprints to avoid repeatedly hashing unchanged managed files.
- Prevent older refresh errors and completed actions from changing or closing a newly opened launcher session. Expired sessions cannot display an old confirmation, and Escape no longer implies cancellation after a confirmed command has been dispatched.
- Normalize damaged individual usage records while preserving valid favorites and counts.

## 3.6.0 — November 5, 2026

- Fill Estimated usage on cards and details with observed DarkDesk launch patterns or clearly labeled category estimates; keep unknown and invalid histories usable without inventing OS telemetry.
- Add per-category custom HEX colors, six gradient palettes, live previews, and matching Windows ICO generation from the same local artwork.
- Apply saved visual changes to existing DarkDesk-owned Windows category folders while protecting user-customized metadata and file-operation undo.
- Add a local calculator and unit converter to Quick Launcher, with localized display and canonical clipboard results.
- Add explicit Google, YouTube, and GitHub prefix searches through fixed HTTPS providers.
- Add Windows Lock Screen, Toggle Mute, Empty Recycle Bin, and Shut Down commands; destructive actions require expiring, single-use confirmation.
- Add Tab/Ctrl+K item actions for favorites, file location, and Windows administrator launch through UAC.
- Show result-type badges, the three most-used observed items, and persistent favorites; load the expanded launcher on demand.

## 3.5.1 — November 5, 2026

- Prevent delayed runtime snapshots from overwriting newer operation events and leaving organization controls blocked after a folder-style change.
- Keep Undo controls disabled while a native operation is active, and read current activity after asynchronous native status checks.
- Add deterministic regressions for the stale-state race and synchronize native/browser checks with completed screen loading and animations.

## 3.5.0 — November 5, 2026

- Add ten per-group folder colors and Gradient, Solid, and Outline styles, with live previews and 360 matching Windows ICO assets.
- Apply folder appearance to existing category folders explicitly. Protect manually customized metadata, verify ownership, recover interrupted updates, and keep appearance changes separate from file-move undo.
- Preserve original application logos and shortcut icons while customizing category folders.
- Show accurate nested group totals, subgroup navigation, breadcrumbs, remembered group ordering, and an option to hide empty groups.
- Explain automatic assignments, expose uncertain fallback matches through a review filter, and keep manual assignments and custom rules first.
- Improve file-type classification so source files, images, media, archives, and reading formats are not redirected by unrelated topic words.
- Add category search, quick subgroup creation, and live keyword/regex match previews.
- Add Solarized Night and Paper Ivory, bringing application appearance to 13 palettes plus System Theme.
- Refine desktop spacing, folder cards, contrast, and themed scrollbars with visible hover, keyboard, reduced-motion, and forced-color behavior.
- Load secondary screens on demand and exclude native source/build outputs from development-view reloads.

## 3.4.3 — November 4, 2026

- Discover personal and common Windows desktop shortcuts, with distinct identities, source counts and access diagnostics.
- Preview common-desktop moves explicitly, preserve undo, continue other selected items after common-source permission failures, and exclude shared sources from unattended archiving.
- Read bounded UTF-8/UTF-16 game InternetShortcut metadata locally; preserve manual/rule precedence and avoid mistaking a game for its launcher.
- Recognize repeated shortcut/copy labels and product version suffixes; add FlutterFlow, VMware Workstation Pro and Windhawk to the 94-app local purpose catalog.
- Show copy-mode behavior, per-item actions, shared-source badges, source paths and filtered result counts.
- Isolate mocked icon tests from the Windows shell, normalize equivalent test paths, and expose CI failure diagnostics in GitHub annotations.

## 3.4.2 — November 4, 2026

- Public GitHub update provider that requires no personal access token and never reads a historical private-feed credential.
- English project page, banner, screenshot gallery, documentation, release notes, and contribution guidance.
- English bug/feature forms and pull-request template, with repository publishing instructions.
- Packaging and runtime update-source consistency checks; app and preview version labels follow the package version.
- A one-time manual installation of 3.4.2 or later is required to switch existing 3.4.1 private-feed installations to the public updater.

## 3.4.1 — November 4, 2026

- Update access for a private GitHub repository using the user's own read-only access token.
- Encrypted Windows DPAPI storage; tokens are excluded from status and settings JSON.
- No private-repository requests without a token; replace/remove controls and a fresh check after token changes.
- Private release configuration without embedding user credentials in the EXE.

## 3.4.0 — November 3, 2026

- The System Scanner action scans the selected source; Desktop and Downloads no longer trigger installed-app discovery by mistake.
- Source changes clear filters, reject stale results, and show source-specific status.
- Four new palettes, four local font-family choices, and Rounded/Duotone UI and native icon packs.
- New internet, learning, and finance categories: 10 main groups and 25 total groups; schema 4 migration preserves user assignments.
- Alt+X is the default launcher shortcut for new installations; existing personal bindings are preserved.
- Explicit download/install with `electron-updater`, OS and in-app notifications, progress, and error states.
- Validation of Windows Setup/Portable packages, `latest.yml`, and blockmaps; automatic GitHub release publication when the version increases.

## 3.3.0 — November 3, 2026

- Folder decoration/attribute and timestamp-preservation failures no longer block the underlying file move; warnings are recorded in operation history.
- Only content-verified destinations count as successful. If source deletion fails, both the source and verified copy are retained.
- Operation results show actual action counts, target-folder links, skip reasons, and undo.
- Original icon and launch information for `.lnk` and `.url` shortcuts; executable shortcuts retain their app icons.
- Native icon extraction through fixed PowerShell/Windows APIs, with PNG validation, timeouts, and manual refresh.
- An 82-app local Turkish/English purpose catalog, name/target matching, and explicit estimate labels for unknown items.
- Compact headings, profile strip, and category cards; an opaque Spotlight panel; corrected main-category count.

## 3.2.0 — November 3, 2026

- Ocean Blue, Forest Green, Rose Light, High Contrast, and a live System Theme option.
- Shared theme validation, safe appearance cache, and text-scale, density, and motion preferences.
- More readable desktop text, larger selection targets, flexible card layouts, and a keyboard skip link.
- Portal dialogs, inert backgrounds, stable cursor/focus, keyboard dismissal of Spotlight, and inline dialog errors.
- Unsaved move/copy preferences survive appearance changes.
- Window position, size, and maximized state are remembered; windows return to the visible area when monitors change.
- Native window backgrounds follow the theme; Spotlight fits within the available screen.
- Local Turkish/English Help & Getting Started screens.
- Watcher fix prevents unexpected development-page resets while package outputs and test reports are written.

## 3.1.0 — November 3, 2026

- Original `.exe` / `.lnk` icons from the trusted index, with lazy loading and a bounded fingerprint cache.
- Details panel with file size/dates, Windows resource description/company, and DarkDesk launch history.
- Fixed title bar/sidebar, scrolling limited to main content, and larger window-control targets.
- Clearer category borders, text, and icon accents across themes.
- Keyboard shortcut recorder, duplicate-binding checks, and global-shortcut changes that preserve working registrations.
- Temporary shortcut suspension during recording, with restoration after cancellation, focus loss, or timeout.
- Fixed delayed stdout and partial UTF-8 decoding in Windows visibility output.

## 3.0.0 — November 3, 2026

- Focus profiles preserve original Hidden attributes through Windows batch APIs and a Linux `.hidden` adapter.
- Global profile shortcuts, custom always-visible file/folder names, and recovery after exit or interruption.
- Separate glass-style Spotlight window with fuzzy search, keyboard navigation, controlled native opening, and system commands.
- Local usage counters and Archive suggestions only for observed inactivity of at least six months.
- Default IDE, Database, DevOps, Terminal, Driver, Network, Compression, System Utilities, and Installer subgroups.
- RE2JS regex rules, exclusion/allow lists, and configurable scan depth.
- Offline vector-based tag suggestions for unknown names, with user confirmation and an explanation of similarity.
- Archive/Downloads automation starts disabled; stability delays, undo, and protection against immediately reprocessing restored files.
- Internal and native drag and drop, with controlled previews for external files.
- X hides to the tray; native context menu and orderly exit that waits for active work.
- Preview reconciliation verifies file hashes when profile changes affect `ctime`.

## 2.0.0 — November 3, 2026

- Read-only, cancellable discovery of Program Files, Start Menu, App Paths, and registered install locations; Linux application-directory support.
- Native category shortcuts for installed apps without moving installations, plus undo.
- Dynamic categories and subgroups, safe folder names, and cycle/collision validation.
- Ordered name/target and extension rules, with editing and enable/disable controls.
- Midnight Dark, Cyberpunk Neon, and light Minimal Slate, using CSS variables and persistent preferences.
- Lucide, Tabler, and Minimalist icon sets, category/item selection, and 36 native folder icons.
- Turkish/English JSON dictionaries for navigation, settings, status, errors, and notifications.
- Bottom-right undo notifications, illustrated empty states, CSS animation, and reduced-motion support.
- Category-ID migration for older settings; operation history retains old and new destinations.
- Incremental loading in batches of 48 cards, scan limits, and access warnings.

## 1.1.0 — November 3, 2026

### Added

- Confirmation previews with per-file destinations, sizes, and collisions.
- Saved move/copy preferences, category assignments, excluded extensions, and live scanning.
- Windows shortcut-target reading, size/date sorting, and file/shortcut filters.
- Automatic list refresh when the desktop changes, without unconfirmed moves.
- Persistent operation history with state tracking and undo after restart.
- Double-click launcher that selects the correct folder for Windows ZIP users.
- Windows NSIS installer and portable EXE workflow, plus application icons.
- Windows/Linux test automation, Chromium UI tests, and a real Electron/IPC smoke test.
- Screenshots, Windows setup/troubleshooting documentation, and a contribution guide.

### Fixed

- Undo verifies SHA-256 content hashes instead of relying only on size and timestamps.
- Copy, move, and restore stages are journaled separately for interruption recovery.
- Collisions are skipped without overwriting files; changed sources/destinations are checked after confirmation.
- Bulk selection in a filtered view affects visible items only.
- Card actions reveal files in Explorer/Finder rather than executing them.
- IPC is restricted to the main window/frame; permission requests and new windows are denied.
- Preview dialogs support focus management, Tab cycling, and Escape.

## 1.0.0

Initial React, Tailwind CSS, and Electron workspace with file categories, basic move/copy operations, and undo.
