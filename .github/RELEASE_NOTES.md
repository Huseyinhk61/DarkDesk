## DarkDesk 3.8.1 — Windows and Linux

### Downloads

- **DarkDesk-Setup-3.8.1.exe**: recommended Windows installation and in-app updates.
- **DarkDesk-Portable-3.8.1.exe**: portable Windows application.
- **DarkDesk-3.8.1-x86_64.AppImage**: Linux x86-64 desktop application with in-app AppImage updates.
- **DarkDesk-3.8.1-amd64.deb**: Ubuntu/Debian package with application-menu integration.
- **SHA256SUMS.txt**: checksums for Windows/Linux artifacts and update feeds.

### Fixes

- Use Electron’s OS-aware network/proxy transport for native currency requests. Add manual rate refresh, shared response-size validation, empty-feed rejection and accurate cache status.
- Read Linux desktop-entry names and comments for useful card labels, descriptions and categorization. Filter hidden service entries and add Flatpak, Snap and AppImage discovery roots.
- Launch desktop entries through GIO and report dispatch errors; launch executable AppImages directly without a shell. Preserve executable bits on copied launchers and align the installed desktop name with the window class.
- Build and verify both AppImage and DEB artifacts and publish a Linux update feed. Existing Windows-native folder icons/startup tools remain platform-specific.

Currency conversion uses the computer’s network/proxy configuration and the provider’s published reference date. No API key is required; an offline fallback is labeled. These are reference rates, not streaming trading prices.

Read [Linux support](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/LINUX.md) and [validation](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/VALIDATION.md) for completed checks and remaining network-validation scope.
