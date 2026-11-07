## DarkDesk 3.10.0 — A calmer desktop, smarter utilities

### Downloads

- **DarkDesk-Setup-3.10.0.exe**: Windows installation and in-app updates.
- **DarkDesk-Portable-3.10.0.exe**: Windows Portable; update manually.
- **DarkDesk-3.10.0-x86_64.AppImage**: Linux with AppImage updates.
- **DarkDesk-3.10.0-amd64.deb**: Ubuntu/Debian package; update manually.
- **SHA256SUMS.txt**: package/update-feed checksums.

### Desktop improvements

- All sidebar destinations fit without a vertical menu scrollbar at common desktop sizes.
- A larger currency-result card and compact converter widget make amounts, swaps, rate dates and copying easy. The launcher accepts `50 usd to try` or `100 eur` as well.
- Pomodoro offers work/break durations, cycle count, five accent colors and an adjustable completion bell with a test button. Completion advances once across windows; press Start for the next phase.
- Widgets snap to a grid and seek free space when shown, moved, resized or reset. Background opacity has 1% steps; blur has 0–32px control. If the screen is full, reduce sizes or hide a panel.

### Windows launcher commands

Use `sys mute`, `sys unmute`, `sys volume up` and `sys volume down` for direct default-output Core Audio control. Volume steps are five percentage points. `sys screenshot` opens native region capture; `sys wifi on` / `sys wifi off` request Wi-Fi radio state through WinRT. Device/policy denial is reported as an error.

`sys night light` opens Windows Night Light settings, and `sys clean space` opens Storage Sense. These settings actions let the user confirm changes in Windows; they do not claim a direct Night Light toggle or delete files automatically. Native commands remain unavailable in browser preview and unsupported platforms.

### Rate and alarm details

Currencies use Frankfurter's dated institutional reference rates, not streaming market prices. Minute checks reuse the validated cache; Refresh requests fresh data. This cloud's provider permission remains blocked, so automated currency verification uses controlled dated responses. Installed applications use their own OS connection.

Use Test bell to check your output device. DarkDesk's own focus timer may sound while its process/widget is active; it cannot sound after the process exits or while the computer sleeps. An elapsed saved deadline is handled when its widget runs again.
