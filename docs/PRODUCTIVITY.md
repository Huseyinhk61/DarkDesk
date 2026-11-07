# Widgets, startup management, and focus analytics

DarkDesk provides local widgets, startup tools and focus analytics alongside file organization. Their platform support differs, and the interface reports unsupported capabilities instead of inventing system data.

| Tool                                   | Windows                                                                              | macOS                                                               | Linux                   | Browser preview                                   |
| :------------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :---------------------- | :------------------------------------------------ |
| System, note, task and utility widgets | Native transparent windows; desktop attachment with floating fallback                | Native interactive windows at desktop level, with floating fallback | Native floating windows | Inline note/to-do preview; no native CPU/RAM data |
| Startup management                     | Supported current-user Run and Startup-folder entries; machine Run entries read-only | Unsupported                                                         | Unsupported             | Unsupported                                       |
| Foreground/open-app analytics          | Opt-in native sampling                                                               | Opt-in native sampling                                              | Unsupported             | Unsupported; no fabricated history                |

The Windows installer remains the primary distributed package. macOS support for these modules does not imply a signed/notarized macOS installer, deep app discovery, or profile visibility support.

## Desktop widgets

Open **Desktop Widgets** in the sidebar and show any combination of:

- **System monitor:** separate Overview, CPU, Memory and Disk views. Overview has labeled utilization bars and used/total RAM. CPU offers a history chart and pages of up to 16 logical processors. Memory separates used/free RAM and DarkDesk process RSS; Disk labels used percentage and free capacity. The first CPU sample displays a dash until a time delta is available.
- **Sticky note:** a plain-text note, up to 20,000 characters, saved after a short typing delay.
- **To-do list:** up to 100 tasks, with completion and removal controls.
- **Currency converter:** amount/currency controls, swap, dated results, refresh and copy. Also available as a full sidebar screen. Provider errors and offline snapshots are explicitly labeled; these are reference rates, not streaming prices.
- **Clock & date:** local time, date and timezone.
- **Focus timer:** 1–180 work minutes, 1–60 break minutes, 1–12 work cycles, five accent colors and an optional completion bell with a volume slider and Test bell button. Work completion prepares a break; break completion prepares the next work period. The final work cycle resets the set. Each next phase waits for Start. Completion is claimed once across windows. Saved deadlines continue to elapse while closed; missed completion is processed when the widget runs again. Sound requires an active process and an available audio output; it cannot wake a suspended computer.

Choose each widget’s **Background opacity** (25–100%) and **Size** in its gallery card. Opacity uses 1% steps. Background blur is fixed at 16px and is no longer a user setting. Widget scrollbar tracks are hidden; long notes and task lists retain wheel, touchpad and keyboard access. Release the opacity slider or finish a keyboard adjustment to save. Opacity changes the background while text remains readable. Drag a native window edge for custom dimensions; saved larger dimensions are retained. Show/hide and layout changes do not erase content.

The system options let you choose core bars, history, details and disk capacity, and a 1/2/5/10-second CPU polling interval. CPU model, logical processor count, free RAM and DarkDesk main-process RSS come from native APIs. Disk capacity uses the Desktop volume and is cached for 15 seconds; it is not a disk throughput measurement. Unavailable metrics remain unavailable.

Drag a widget by its header. The text fields, checkboxes, and buttons remain interactive. Hiding a widget retains its contents. Enabled widgets, their bounds, the note, tasks, and placement mode are stored in `widgets.json` under Electron's application-data directory. Enabled widgets return at the next normal launch. Saved bounds are clamped to available work areas if a monitor has been removed. Showing, moving, resizing or resetting widgets snaps their positions to an 8px grid and seeks nearby free space with a 12px gap using actual window dimensions. Positions remain clamped to the current monitor work area, including monitors with negative coordinates. A full screen can have no valid placement; the gallery then asks you to reduce sizes or hide panels rather than pushing them off-screen.

### Desktop or floating placement

**Desktop** placement uses an Explorer desktop-host adapter for read-only system/clock panels on Windows and an interactive native window-level adapter on macOS. The adapters operate on DarkDesk's own widget windows. A desktop session without a suitable host, native-binding failure, or an unsupported platform produces an explicitly labeled **Floating** fallback. The placement status reflects the adapter result; selecting Desktop does not guarantee attachment.

On Windows, notes, tasks, currency and focus controls always use independent focusable windows: cross-process desktop parenting can prevent normal text input. Showing an editor focuses it; restored startup widgets do not steal focus. macOS retains its supported interactive desktop-level windows.

**Floating** placement keeps ordinary independent windows below always-on-top overlays. It does not pin them above other applications. Changing placement flushes pending note drafts before recreating windows. Hiding and quitting also attempt to flush drafts. If saving fails, DarkDesk keeps the affected window available so the user can retry rather than destroying an unsaved note.

Widgets are not a document backup system. A forced process termination or power loss before a pending save completes can still lose recent edits. Their renderer uses a restricted IPC subset for widget state, appearance, and system metrics; it cannot invoke general file organization or startup-management actions.

The browser preview can display the same note and to-do interfaces inside the page, using browser storage. It cannot attach panels to the OS desktop or read live CPU/RAM data. Browser and desktop-app storage are separate.

## Startup manager

Open **Startup Manager** to refresh the Windows startup list. Search by entry name or displayed command, inspect its source, and toggle an editable entry. Commands are read as metadata and are never executed by this manager.

Editable sources are:

- The current user's `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entries.
- Supported ordinary `.lnk` and `.url` files in the current user's Startup folder.

Disabling writes the corresponding Windows **StartupApproved** flag. It does not delete or rewrite the original Run command or shortcut. DarkDesk records the original approval state before its change; when re-enabling an entry still under its control, it restores that state. It rechecks the command, approval state, and applicable file fingerprint before writing. An entry changed externally must be refreshed rather than overwritten using stale data.

Machine-wide `HKLM` Run entries are listed read-only. Unknown approval formats, unsupported value kinds, unsafe paths, or entries that cannot be validated are also read-only. DarkDesk does not request elevation to bypass those restrictions.

A toggle affects future Windows sign-ins; it does not stop a currently running process. The module does not enumerate every scheduled task, Windows service, store-app startup task, policy-managed application, or every registry architecture view. It does not calculate a fabricated boot-time improvement. An application or administrator can also recreate its own startup configuration later.

macOS, Linux, and browser preview show an unsupported state. They do not simulate successful startup changes.

## Focus analytics

Analytics starts **off**. Open **Focus Analytics** and explicitly enable collection on a supported platform. Disabling stops subsequent sampling while retaining history; **Clear history** removes stored aggregates after confirmation. Clearing does not disable a tracker that is already enabled, so turn it off as well if you want no new records.

### What the numbers mean

DarkDesk samples approximately every **15 seconds**, while the app is running, including in its tray. It attributes intervals only when successive samples are close enough and refer to the same applicable application/profile. Gaps longer than 20 seconds are not backfilled. An interval spanning local midnight is split between the two dates.

- **Foreground time:** sampled intervals in which the same application holds the foreground at both ends. Switching apps between samples can leave time unattributed; these values are estimates, not a complete activity log.
- **Open-app time:** intervals in which the same eligible application appears at both ends of the sample. On Windows this covers current-session processes with a main window; on macOS it covers regular applications from `NSWorkspace`. Concurrent apps accumulate overlapping time, so their durations must not be summed as elapsed wall-clock time. Services and every background helper are not covered.
- **Profile time:** sampled active intervals with the same DarkDesk workspace profile at both ends. The normal desktop is reported separately from named profiles.

Both foreground and open-app collection pause when OS idle time reaches **60 seconds**, when the screen is locked, or while the system is suspended. The open-app figure therefore measures eligibility during active sampled periods; it is not the app's total process lifetime, installation age, or all-day background runtime.

The dashboard offers 7-day and 30-day ranges. **No history yet** is expected on a new installation, before opting in, or before enough valid samples arrive. Unsupported platforms show no fabricated chart. Repeated sampling failures stop collection and display an error; disable and re-enable after resolving the cause to retry.

### Local data and retention

`productivity.json` stores local dates, application names, hashed application identities, foreground/open durations, and profile durations. Raw executable paths, window titles, document names, and browser URLs are not written to this history. Native samplers use executable paths transiently to derive stable hashed identities. A hash is an identifier rather than encryption.

History is retained for up to **90 days**, with bounded application identities. There is no cloud analytics endpoint, account, or external AI request. This module is separate from `usage.json`: launch counts and the card's **Estimated usage** label still describe launches submitted through DarkDesk or category-based estimates, and do not become Windows-wide measurements.

A normal quit flushes pending aggregate records. Forced termination can lose the most recent unflushed samples. OS APIs, permissions, secure desktops, and timing changes can reduce coverage. macOS and Windows sampling require a real graphical session. The browser preview and Linux do not start a fake native tracker.

## Related guides

- [Quick Launcher and command prefixes](LAUNCHER.md)
- [Native app descriptions and metadata](DESKTOP-UX.md)
- [Profiles and background file automation](ECOSYSTEM.md)
- [Folder colors and themes](FOLDER-APPEARANCE.md)
- [Validation and platform limits](VALIDATION.md)

### Compact controls in 3.7.1

Each panel can collapse to a 44-pixel header without discarding its note or tasks. Collapse state survives restart, and expanding restores compact content bounds. The system panel shows per-core CPU samples and a memory percentage bar; its polling pauses while collapsed.

Folder artwork now uses immutable content-addressed files in DarkDesk’s local `folder-artwork` cache. Windows `desktop.ini` references this cache so Explorer distinguishes color and style changes from its previous icon identity. Existing custom folder metadata remains protected. Saving an unchanged category also retries the appearance update for older folders.
