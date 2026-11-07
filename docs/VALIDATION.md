# DarkDesk validation report

## 3.12.0 — personal tools and Microsoft Store preparation

Local validation on Linux:

- **340 service/model tests passed**, with one Windows-only Core Audio compilation/parser test skipped locally. Tests include saved currency targets/pairs, TL expressions, legacy hotkey migration, default-mode dispatch, Unicode note preservation, disk discovery/cache/unavailable drives, weather parsing/cache/error/size bounds, platform-provider discovery and Store update isolation/identity validation.
- **153 full browser scenarios passed** before the final migration/minimum-size safeguards. The final affected browser set passed, including fixed widget geometry, independent transparency, Unicode/CJK/tab notes, all disk pages, weather settings, custom currency pairs/default launcher target, beta-language persistence, Store-only update UI, editable notes/tasks, focus bells and accessible modal behavior. CI runs the complete final suite.
- Final production build and isolated native Electron smoke tests passed: real move/undo, custom scanning, installed-app shortcuts, original icons, restricted IPC, global shortcut capture, native note/task editing and persistence/restart. Widget minimum sizes protect fixed controls while adapting to the display.
- Generated and validated **170 pack ICOs** and **2,380 color/theme ICOs** (34 icons × seven folder styles × ten colors). Preview/native artwork uses the shared folder renderer; existing personal folder metadata remains protected.
- Microsoft Store configuration passed electron-builder schema validation using an isolated **test identity**, and the real build command correctly refuses missing/placeholder Partner Center identity values. This is preparation, not certification: no real Store identity, signing credential, installation test, WACK result or Microsoft approval is available.

Live `api.met.no` access returned a cloud proxy CONNECT **403**. Provider response parsing, bounded requests, cached/offline behavior and weather UI were tested with controlled responses; live weather availability is not established here. Currency likewise uses controlled reference-rate fixtures. No cloud network restriction was bypassed. No live shutdown, trash emptying, radio mutation or audio-volume mutation was performed by the tests.

Public installer/release verification follows the successful remote workflows; see the publication evidence below once available.

## 3.11.0 — readable widgets, folder application and location discovery

Date: November 7, 2026 (Europe/Istanbul).

- **327 Linux service/model tests passed; one Windows-only compilation check was skipped locally.** New cases cover independent custom/system/Desktop indexes, noisy-file exclusion, nested discovery, canonical paths, invalid/symbolic-link roots, replacement of a chosen location, launcher indexing and shortcut-only previews. Exact app matches, adjacent versions, purpose hints, explicit overrides and Linux freedesktop categories are checked.
- The full local browser run passed **144 scenarios**; its remaining assertion still addressed the old system-monitor markup. After updating that assertion to the new overview cards, **14 focused widget/productivity/utility scenarios passed**. Another 16 folder/layout/launcher scenarios and 19 color/scanner/utility checks passed during implementation. Final full CI evidence is recorded below after publication.
- Production build and real source Electron/native-widget checks passed. Native scanner UI opens an injected directory picker, lists the chosen application, returns to Desktop/system sources and verifies that the source program remains in place. Existing move/Undo, watchers, icons, tray behavior and preferences remain covered.
- Compact System Monitor Overview and CPU layouts were measured at 292×230 without internal overflow. Widget scrollbar tracks are hidden; longer notes/lists remain accessible. Blur is fixed at 16px and no longer exposed as a setting. Updated English gallery/category/currency screenshots are interface previews; the currency illustration uses a controlled sample rate.
- The category editor saves preferences before explicitly creating/styling its selected physical Windows folder. Browser tests verify that the saved palette reaches this operation, while existing filesystem tests verify real ICO/INI ownership, rollback and cache-safe artwork paths. Personal icon metadata remains protected. This Linux run does not establish a live Windows Explorer redraw.

Rates remain dated provider snapshots, not streaming quotes. Live Frankfurter access is outside this cloud's allowed hosts, so conversion/transport tests use controlled responses. App matching is local and bounded: 191 known applications, supported Linux metadata and purpose hints complement manual choices/rules; unknown applications stay reviewable. The native picker scans supported applications/shortcuts read-only, not arbitrary documents, and organizing those results creates shortcuts rather than moving installed programs.

**Published and verified:** [Desktop Installers](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42365892558) passed Windows Setup/Portable and Linux AppImage/DEB packaging, native packaged widget IPC, checksum/update metadata verification and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42365892482) passed **all 145 browser scenarios**, Windows/Linux services and native IPC, and macOS interactive desktop widgets. Windows selected-location checks compare canonical paths, including expansion of temporary-directory 8.3 aliases.

[Release v3.11.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.11.0) is public and its tag points to source commit `4f30b3c`. Windows and Linux latest update feeds report 3.11.0. Anonymous Setup, Portable, blockmap, AppImage and DEB requests returned HTTP 200. Complete Setup and AppImage downloads matched the published SHA-256 records and the update feeds’ SHA-512/size metadata. This verifies delivery and updater availability; an in-place installation on an end-user computer was not performed by this cloud session.

- DarkDesk-Setup-3.11.0.exe: 134,926,366 bytes; SHA-256 `5bfb0ee200b256db75e24faacf72470498eb832734c0c1d15d58a7e9149cecea`.
- DarkDesk-Portable-3.11.0.exe: 121,543,789 bytes; SHA-256 `40768a89f0f170c3f88c4c2cb6a67b2f967c433a4bcc0f8ad02a018406ca291b`.
- DarkDesk-3.11.0-x86_64.AppImage: 142,826,249 bytes; SHA-256 `da9f5201270563ccf50fa9487fec626f7a3f29a172726f32b441c114ab2e3379`.
- DarkDesk-3.11.0-amd64.deb: 113,718,112 bytes; SHA-256 `01be42620ff70c8617e4f830947a3e1fd48dc1a187d585d3fe75841aab67eb9b`.

## 3.10.0 — desktop utilities and compact navigation

Date: November 7, 2026 (Europe/Istanbul).

- **323 Linux service/model tests passed; one Windows-only compilation check was skipped locally.** New cases cover one-time Pomodoro completion across concurrent renderers, work/break/cycle transitions, invalid settings, independent blur persistence, actual-size widget collision handling on negative-origin monitors, fixed Core Audio/WinRT dispatch, supported Windows tool URIs and native failure propagation.
- **140 browser scenarios passed** in the complete final run. New checks cover every sidebar destination plus system/footer geometry at 1366×768, 1440×900 and 900×600 with 100%/130% text; persisted Pomodoro customization, a single synthesized bell, and independent fine opacity/blur controls. Nineteen focused utility/launcher/layout scenarios also passed after the final visual adjustments.
- Production build and real source Electron/widget smoke tests passed. Widget IPC advances an expired focus deadline into a break, rejects stale completion claims and applies the blur setting to its actual window. Existing note/task typing, save/restart, source-specific scanning, move/Undo, native launcher dispatch and tray behavior remain covered.
- The native automation fixture triggers a genuine file-watcher refresh. Its test now waits for an editable form interval and verifies both checkbox states before saving, instead of assuming the fieldset cannot become temporarily disabled between pointer-down/up.
- The converter and compact widget were visually inspected; the English README screenshot uses a clearly labeled controlled sample rate. Currency-provider access remains outside this cloud's allowed hosts. Mocked dated responses establish conversion/refresh/error handling, not a successful live-provider request.

Native sound/radio state, shutdown, lock and recycle-bin operations are tested with injected adapters, without changing this development host. Windows CI additionally compiles the Core Audio interop and parses the fixed Wi-Fi script without modifying device state. Night Light and storage cleanup intentionally open supported Windows control pages; they are not direct toggles or unattended deletion. Full displays retain clamped widget bounds and expose a crowding hint when no free position exists. Publication checks are recorded after the release below.

**Published and verified:** [Desktop Installers](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42361069341) passed Windows Setup/Portable and Linux AppImage/DEB builds, native packaged IPC, metadata/checksum validation and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42361069237) passed Windows/Linux services and native checks, **140 browser scenarios**, and macOS interactive desktop widgets. Widget tests now exercise window recreation on Linux too and reacquire the current note renderer before checking its blur preference and computed filter.

[Release v3.10.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.10.0) is public and its tag points to source commit `77ef617`. Windows and Linux latest update feeds both report 3.10.0. Anonymous Setup, Portable, blockmap, AppImage and DEB requests returned HTTP 200. Complete Setup and AppImage downloads matched the release SHA-256 records and the update feeds’ SHA-512/size metadata. These checks do not establish an in-place upgrade on an end-user computer or live audio/radio operation on physical hardware.

- DarkDesk-Setup-3.10.0.exe: 134,901,950 bytes; SHA-256 `f9692df3376b9a74902823a279b8f5695aa09d13f62a00864406a2c7d64ffd32`.
- DarkDesk-Portable-3.10.0.exe: 121,529,274 bytes; SHA-256 `0286f038cd9bb1211609dc70550d0f529e0564f70a58137a8c493b09467aedeb`.
- DarkDesk-3.10.0-x86_64.AppImage: 142,809,749 bytes; SHA-256 `004e727b7897735e7610b938b736aa61bdc8349afd54435e3eb93d921b402d20`.
- DarkDesk-3.10.0-amd64.deb: 113,707,088 bytes; SHA-256 `67317b7a3889872986125b905107844149ac0902ec4a17dbc2cd8a01712881e9`.

## 3.9.0 — editable widgets, currency form and folder preparation

Date: November 7, 2026 (Europe/Istanbul).

- **319 Linux service/model tests passed.** Added migration of older notes/tasks, validated opacity/size/system preferences, retained custom bounds, non-overlapping default widget positions, Windows editable-window placement, wall-clock focus timing, cached disk-capacity sampling, glyph-size vectors/native dispatch and explicit one-category folder creation without modifying unrelated files.
- **134 browser scenarios passed** in the full local run, including five new currency/widget/folder flows. The dedicated converter covers amount, swap, refresh and clipboard behavior; note/task input, opacity, presets, system controls, utility widgets, right-click customization and enlarged-text/narrow layouts are covered. Seventeen pre-existing widget/folder regressions also passed in a focused run.
- Production build and isolated real source Electron file-operation smoke passed. Expanded native widget checks passed CPU/RAM readings, editor/task input and restart persistence, clock/focus/currency windows, restricted IPC and opacity/resize state. Shutdown now probes only note frames for debounced drafts; a disposed non-note frame no longer blocks exit, while genuine note-save failures still preserve the editor.
- Folder tests create and inspect actual ICO/INI metadata with injected Windows attributes. The real Windows branch additionally exercises native icon rendering; final cross-platform packaging/publication evidence is added after completion below.

The live FX provider is outside this managed cloud runtime's allowed hosts, so converter math, caching and transport responses use controlled dated data. This is not a successful live-provider probe. Windows interactive editors intentionally use focusable floating windows; system/clock panels can attach to the desktop. Native Explorer redraw and a real end-user Windows upgrade are not established by Linux checks. macOS retains its interactive desktop-level adapter, with platform checks in CI.

**Published and verified:** [Desktop Installers](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42301212527) passed Windows Setup/Portable and Linux AppImage/DEB builds, metadata/checksum validation, packaged widget IPC/native bindings and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42301212548) passed Windows/Linux services and native checks, **134 browser scenarios**, and macOS interactive widget checks.

[Release v3.9.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.9.0) is public and its tag points to final source commit `901f742`, including the one-time category-editor request fix. Windows and Linux latest update feeds report 3.9.0. Anonymous Setup, Portable, blockmap, AppImage and DEB requests returned HTTP 200. Complete Setup and AppImage downloads matched the release SHA-256 records and the update feeds’ SHA-512/size metadata. Currency/gallery layouts were also inspected in browser preview using a controlled sample reference rate; this does not extend the live-provider verification scope.

- DarkDesk-Setup-3.9.0.exe: 134,905,380 bytes; SHA-256 `60e65cc84ead3b4e529205036fb5c020e8b0af33d08d66eb2ea2615e608af2cf`.
- DarkDesk-Portable-3.9.0.exe: 121,522,762 bytes; SHA-256 `8b3ab25c326f1d1c9cd6278a32e3a18daaadf4feead6c02442e289ea9d8d05ab`.
- DarkDesk-3.9.0-x86_64.AppImage: 142,802,010 bytes; SHA-256 `2ac18e772fa5d3ea45bc2541e68501a55214cc440745a5a134d3867848058107`.
- DarkDesk-3.9.0-amd64.deb: 113,700,196 bytes; SHA-256 `fa97d6b278024357e649ecf6e93bd383b560cdad18fe62afc690fddc5747fa3e`.

## 3.8.2 — published delivery and resilient update checks

- **311 Linux service/model tests passed.** New scheduler cases cover the initial delay, the fifteen-minute error retry, six-hour normal checks, throttled wake signals, recent manual checks, download/install exclusion, deduplicated requests and disposal. Release-note links are limited to the official repository with validated version tags.
- **129 browser scenarios passed locally and in GitHub Actions**, alongside 14 focused update/layout checks, including progress/install ordering, unsupported Portable builds, a retained navigation indicator after dismissal, release-note actions and protection against delayed status failures. The included production-polish source previously passed 125 full browser scenarios and 16 final focused checks.
- The 3.8.2 production build, real source Electron/file-operation smoke and widget-window smoke passed. New release-notes IPC is present in the isolated preload. Actual updates remain explicit downloads/restarts; no unattended application installation was dispatched during these tests.

**Published and verified:** [Desktop Installers](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42284298206) passed Windows Setup/Portable and Linux AppImage/DEB packaging, update metadata/checksums, packaged native smoke and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42284298297) passed Windows/Linux service/native checks, **129 browser scenarios**, and macOS widget IPC.

[Release v3.8.2](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.8.2) is public and its tag points to release source commit `c64b8a5`. Both latest update feeds report 3.8.2. Anonymous Setup, Portable, blockmap, AppImage and DEB requests returned HTTP 200. Complete Windows Setup and Linux AppImage downloads were streamed and their SHA-256 values matched the release manifest; their SHA-512 values also matched the actual public update feeds. The resulting sizes match the feed metadata.

Live Windows installation/upgrade and Explorer redraw were not exercised in this Linux session. Currency-provider live access remains outside this run's network permission; controlled response tests do not establish a successful provider request.

- DarkDesk-Setup-3.8.2.exe: 134,887,158 bytes; SHA-256 `8014afbc0567fa11d260959aadea2d55e00f300e19bffc43784856a92fdeb0a0`.
- DarkDesk-Portable-3.8.2.exe: 121,516,179 bytes; SHA-256 `f53688f0e397790b8dbe3d521f935c3089e51c075387a6bac31044bf4eb9f03d`.
- DarkDesk-3.8.2-x86_64.AppImage: 142,789,646 bytes; SHA-256 `a7863596b4dcba5b3a0efc22544b03f93a9c1f2c77830bb0e84394da16035a7c`.
- DarkDesk-3.8.2-amd64.deb: 113,690,360 bytes; SHA-256 `1ea688f0e89df3223902b1088eac1a9da793c30ad0cfa38af9fc4b0264762280`.

## Production-polish source checks (included in 3.8.2)

Date: November 6, 2026. Earlier review-branch validation, before the 3.8.2 release described above.

- **307 Linux service/model tests passed**, including real temporary-folder writes for individual style changes, global-style override preservation/reset, metadata checks and retained custom-icon ownership. Category style validation and appearance-signature invalidation share the renderer/native model. Existing AI migration, popular-tool recognition and manual override tests pass.
- **125 browser scenarios passed** in the full run. After the final stationary-pointer selection fix, **16 focused launcher/production scenarios passed**, including actual pointer movement versus layout hover, command/application favorite persistence, amount-free FX inputs, custom palette/style restart and Windows apply dispatch, stale asynchronous results and large-text scanner/startup layouts.
- Production build, source Electron file-operation/IPC smoke and real widget-window smoke passed. The native launcher correctly dispatched the searched file after the selection fix; preview, move/Undo, scanner source switching and widget persistence also passed.
- Formatting and whitespace checks passed. Scanner/startup screens were visually inspected at small desktop widths and 130% text. Expanded startup command paths wrap without horizontal clipping; scanner controls and long application names remain within their cards.

Folder-style tests write real ICO/INI files with an injected Windows attribute adapter. This Linux run does not establish how a live Windows Explorer session redraws them. FX arithmetic/refresh/error checks use controlled dated responses; the cloud FX host permission remains a saved draft, so this report does not claim a successful live-provider request. Rates are institutional reference snapshots, not streaming market prices. New installers were not generated for these unreleased source changes.

## 3.8.1 — Linux packages and proxy-aware currency

- 304 Linux service/model tests passed, including actual GIO dispatch against an isolated temporary marker entry, invalid-entry failure, desktop metadata localization/filtering, manual FX refresh, cache status and bounded response checks. The actual GIO integration case is Linux-only and explicitly skipped on other operating systems.
- 119 browser scenarios passed in the full local run; five focused launcher cases, including manual refresh, passed afterward.
- Production build, AppImage ELF/extraction, DEB metadata/extraction, Linux update SHA-512, and identical packaged ASAR checks passed. All 83 packaged code/renderer/locale files match source. Source and packaged native Electron smoke suites passed.
- The FX host permission was saved using the supported cloud environment configuration draft workflow. Runtime revision 1 still does not grant that host; live FX validation remains pending review/save/publication of that configuration. No proxy, TLS or security-policy bypass was used.

**Published and verified:** [Desktop Installers](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42222354380) passed Windows Setup/Portable and Linux AppImage/DEB packaging, checksum/update verification, source/packaged native IPC checks and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42222354277) passed Windows/Linux service checks, **120 browser scenarios**, and macOS widget/native IPC checks.

[Release v3.8.1](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.8.1) is public. Anonymous Setup, Portable, AppImage, DEB and update-metadata requests returned HTTP 200. Both latest update feeds report 3.8.1, with matching installer/AppImage sizes. Linux update metadata also matches the published SHA-256 record. The cloud FX-provider permission remains a saved draft; these release checks do not establish live-provider access.

- DarkDesk-Setup-3.8.1.exe: 134,894,469 bytes; SHA-256 `86bf54a9bd90fa2f7764ddcc6b186d3f9ba200c863d54c1626d115813991ea00`.
- DarkDesk-Portable-3.8.1.exe: 121,515,056 bytes; SHA-256 `9aa22bea44c30e99c45b17f75d6c59c170f051c4b9e74a0a13771274c9978477`.
- DarkDesk-3.8.1-x86_64.AppImage: 142,790,204 bytes; SHA-256 `60a244af94dbdc45e9900d43785e64ad08ba64d6881e37ba2106238dbd15097e`.
- DarkDesk-3.8.1-amd64.deb: 113,688,312 bytes; SHA-256 `a78af1c5444056ba3fadc1cbd2ef5398fa86e0ea7c1db35a4b996b8286cbb91a`.

## 3.8.0 — AI groups, command favorites, and currency tools

- **299 local service/model/settings tests passed.** New coverage includes fixed-endpoint FX requests, cross-rate arithmetic, request deduplication, offline restart, expired-cache rejection, AI schema migration, user override precedence and generic-metadata fallback.
- **118 Chromium scenarios passed** in the full local run. Four final launcher cases additionally passed after the stale-response guard: command favorite persistence, dated conversion/copy, offline errors and delayed responses.
- Production build and real Electron file-operation/widget checks passed. Native IPC covers command favorite writes and currency conversion using an injected reference snapshot. Formatting and whitespace checks passed.
- The cloud network policy blocks the Frankfurter host. Currency arithmetic, cache, error states and HTTP response handling were tested with controlled responses; this is not a claim of a successful live-provider probe from this environment. The application uses the published reference date and never invents missing rates.

**Published and verified:** [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42212614412) passed service, source and packaged Electron IPC checks, EXE packaging, checksum/update verification and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42212614470) passed Windows/Linux services, **119 browser scenarios**, and macOS widget/native IPC checks.

[Release v3.8.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.8.0) is public. Setup, Portable, blockmap and the public update feed returned HTTP 200; the feed reports 3.8.0 with a matching installer size. Currency-provider network restrictions described above still apply to the scope of verification.

- Setup: 134,893,055 bytes; SHA-256 `fd9f938c003aaee129a09283cc89322926bfc0a2c33cc28ad6a7e095fe6b4605`.
- Portable: 121,514,148 bytes; SHA-256 `69eabd383869afc9a64debd7aa7875613163b073cc77e68c0a9a7336f373941f`.

## 3.7.1 — compact widgets and folder appearance synchronization

- 295 local service/model tests passed. Added persistence and real native-size invariants for collapsed widgets, immutable folder resource identities, cache integrity checks and per-core CPU samples.
- 17 related browser scenarios passed, followed by six final widget/color regressions after contrast refinement. These cover draft preservation, restart, independent collapse, preventing preference reloads on note saves, palette persistence and physical-appearance dispatch.
- Production build, existing Electron file-operation smoke and widget smoke passed locally. Cross-platform checks and publication completed successfully.

- **CI verified:** [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42108117765) passed source and packaged Electron checks, Setup/Portable generation, checksum/update verification and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42108117458) passed Windows/Linux services, **115 browser scenarios**, and real macOS widget collapse/expand controls.
- [Release v3.7.1](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.7.1), Setup, Portable and blockmap are publicly accessible (HTTP 200). The update feed reports 3.7.1 with matching installer size.
- Setup: 134,885,816 bytes; SHA-256 `2b43dd2457f6c00076296011a1bed300628ff19b86817f471c6f7ad20745ac03`.
- Portable: 121,503,700 bytes; SHA-256 `5117a031e675c09bf45733832b71beaed216a5973fadd970aa04a1e3a27f8e42`.

## 3.7.0 — descriptions, widgets, startup control, and focus analytics

Date: November 5, 2026. Local environment: Linux, Node.js 24, Electron 45, Chromium, and Xvfb.

- **293 service/model/settings tests passed**, with no failures or skips. New cases cover metadata/manual/dictionary precedence, launch-host shortcut exclusions, Windows startup approval restoration and stale-entry protection, widget content/position persistence and shutdown races, foreground/open-app/profile sampling, idle/lock/suspend gaps, local midnight, retention, corrupt-history recovery, safe prefix parsing, and bounded command counts.
- **112 Chromium scenarios passed** in the complete final run. New scenarios cover editing and clearing descriptions, prefix help and delayed-load keyboard focus, persistent note/task previews, read-only startup rows and stale-write errors, separate foreground/open durations, opt-in and clear confirmation, unsupported environments, and navigation in short windows.
- Production build, formatting, matching English/Turkish translation keys, and whitespace checks passed. New secondary screens load on demand.
- Both the source application and Linux unpacked ASAR passed the existing real Electron file-operation/scanner/profile/launcher smoke test and the new widget smoke test. Checks include separate windows, actual CPU/RAM counters, immediate note flush before hiding, task completion/deletion/restart persistence, restricted widget IPC, and loading the native addon inside Electron.
- All **79 packaged Electron/shared/renderer/locale files** match the final source tree; the ASAR package version is 3.7.0. Four new English screenshots come from the real browser preview, which explicitly disables native measurement and startup controls rather than supplying invented data.

Startup mutations are tested using injected registry adapters and temporary files, never by toggling the test host’s real startup entries. Analytics timing tests use injected samples; the native CI smoke includes one read-only Windows/macOS adapter probe without enabling or persisting tracking. Lock, shutdown, mute, Recycle Bin deletion, and UAC elevation are not dispatched by these checks. Windows desktop placement may use its documented floating fallback when Explorer is unavailable; macOS CI checks interactive placement of the app’s own NSWindow.

**Published and verified:** [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42087105712) passed source and packaged widget IPC, native bindings, Setup/Portable packaging, release verification, and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42087105670) passed Windows/Linux service and native checks, **112 browser scenarios**, and the macOS interactive desktop-layer widget check. Read-only Windows startup and Windows/macOS foreground adapters ran successfully without enabling analytics or modifying real startup entries.

[Release v3.7.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.7.0) is public. Anonymous Setup, Portable, blockmap, and update-feed requests returned HTTP 200. The public feed reports **3.7.0** and its installer size matches the published asset.

Official release files (use this release’s `SHA256SUMS.txt`):

- Setup: 134,877,571 bytes; SHA-256 `067830951529b99b529fe14ca972a03563e6a45b75c2aca74f599428f8b0ea0b`.
- Portable: 121,504,923 bytes; SHA-256 `0e5ae97dd6c7339b3237ae123b2f62a4ed59f0a93475fe2756f55822d253796d`.

## 3.6.1 — launcher paths, favorites, and session stability

Date: November 5, 2026. Local environment: Linux, Node.js 24, Electron 45, Chromium, and Xvfb.

- **234 service/model/settings tests passed**, without failures or skips. New real-filesystem cases cover move/Undo/restart with stable usage/favorites, copy and installed-source precedence, Downloads identities, verified managed-shortcut recovery, stale-source pruning, preserved-mtime tampering, ancestor symlinks, invalid journals, category changes, concurrent refreshes, and bounded checksum caching. Individual damaged usage records recover without discarding valid records.
- **100 Chromium scenarios passed** with the final renderer. New lifecycle regressions reproduced stale refresh errors, old launch completions closing a replacement palette, and outdated destructive-action preparation before the fix. Tests also cover retained favorites through organization/Undo and preserving the state of a dispatched confirmation.
- Production build and real source Electron smoke passed. The native test launches an organized temporary file at its new path, verifies the same favorite after Undo, holds a launch while reopening the native palette, and rejects an old renderer session's close request.
- The Linux unpacked ASAR passed the same native smoke. Its version, main process, catalog/activity/session modules, and all renderer assets match the current source tree.
- Formatting and whitespace checks passed.
- **Published and verified:** [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42023577199) passed native Windows file/path/session regressions, EXE packaging, metadata verification, and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42023577235) passed Windows/Linux jobs and **100 browser scenarios**.
- [Release v3.6.1](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.6.1) is public. Anonymous Setup/Portable/blockmap requests and the update feed returned HTTP 200. The feed reports 3.6.1 and its installer size matches the published asset.

Official release files (use this release's `SHA256SUMS.txt`):

- Setup: 134,413,076 bytes; SHA-256 `6159b8df3dcc3caa20ecb81963d8fbe485e527bd35ed8eddf2ad37dea447c22c`.
- Portable: 121,069,998 bytes; SHA-256 `dd29c3f8806647cc9c76f4224eb79f6cc60d5685883e5594a9f1d6e74501b73d`.

Recovery reads completed, verified DarkDesk operation history; it does not recursively index arbitrary desktop folders. Missing, modified, symlinked, or otherwise unverifiable managed outputs are excluded. No real external application, lock, shutdown, Recycle Bin deletion, or elevation is executed by these tests.

## 3.6.0 — usage estimates, custom folder colors, and launcher tools

Date: November 5, 2026. Local environment: Linux, Node.js 24, Electron 45, Chromium, and Xvfb.

- **220 service/model/settings tests passed**, without failures or skips. Coverage includes observed-versus-estimated usage, custom-category ancestry, invalid/future history, custom HEX validation, native PNG/ICO generation, safe arithmetic and dimension-aware conversions, fixed web providers, favorite persistence/ranking, trusted-file actions, and expiring one-use confirmation tokens.
- **95 Chromium scenarios passed** in the complete run. New checks cover nonempty bilingual usage labels, observed launch history, custom color/gradient persistence and live previews, automatic Windows appearance dispatch, clipboard results, encoded web searches, persistent favorites, the three most-used results, confirmation cancellation/dispatch, and an unclipped keyboard action menu for a single result.
- Production build and real source Electron IPC smoke passed. Native checks exercise clipboard copying and restoration, favorite persistence, capability discovery, and the existing file-operation/scanner/profile flows. Actual lock, mute, shutdown, Recycle Bin deletion, and UAC elevation are tested through injected adapters; they are never executed on the test host.
- A separate real Electron raster probe generated distinct valid 256-pixel custom-gradient ICOs. Windows-specific custom-folder application is also included in the native smoke branch for the Windows runner.
- New English screenshots were captured from the real browser demo. Browser screenshots show unsupported native actions as unavailable; they do not imply that a web preview can change local folders or system state.

- The Linux unpacked ASAR passed the same Electron smoke. Packaged models, native raster/actions, translations, renderer assets, version 3.6.0, and all 360 preset ICOs were compared with current source.
- **Published and verified:** [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42005932582) passed service tests, native IPC including custom-gradient folder application, Setup/Portable packaging, release metadata checks, and publication. [Test & Build](https://github.com/Huseyinhk61/DarkDesk/actions/runs/42005932607) passed Windows/Linux jobs and **95 browser scenarios**.
- [Release v3.6.0](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.6.0) is public. Anonymous requests for Setup, Portable, blockmap, and update feed returned HTTP 200. The update feed reports 3.6.0 and its installer size matches the published file.

Official release files (use this release's `SHA256SUMS.txt`):

- Setup: 134,410,697 bytes; SHA-256 `66f252ae23adbced9cae249c4553b401f6483e3957cac19ff99ff60332f19cc5`.
- Portable: 121,064,005 bytes; SHA-256 `0e79a5adb01d41452de9dae3fedea1616ca594b1bdac1ed5db6aa1be1eecdea2`.

Usage estimates do not measure time spent in other apps or infer unobserved operating-system launch history. Native Windows metadata and custom ICO generation were checked on the runner; interactive Explorer repaint and a GUI installation/old-to-new upgrade on the user's computer were not performed.

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
