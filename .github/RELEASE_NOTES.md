## DarkDesk 3.8.2 — Update delivery and desktop polish

### Downloads

- **DarkDesk-Setup-3.8.2.exe**: recommended Windows installation and in-app updates.
- **DarkDesk-Portable-3.8.2.exe**: portable Windows build; update manually.
- **DarkDesk-3.8.2-x86_64.AppImage**: Linux x86-64 application with AppImage updates.
- **DarkDesk-3.8.2-amd64.deb**: Ubuntu/Debian package; install new DEBs manually.
- **SHA256SUMS.txt**: Windows/Linux artifact and update-feed checksums.

### Updates that reach installed apps

This release includes the production-polish changes previously available in the review branch. Installed 3.8.1 builds can now discover a newer version. In Settings → Updates, choose **Check for updates**, **Download update**, then **Restart and update**. Old 3.4.1 private-feed builds require a manual Setup upgrade once.

- Retry failed checks after 15 minutes; check again after resume or returning to the app with a 30-minute cooldown. Keep six-hour background checks and explicit downloads/restarts.
- Keep an update indicator in navigation even after its notice is dismissed. Add **What's new in this release** linking to the official version page.
- Prevent a delayed initial-status error from replacing a newer update notification.

### Desktop improvements

- Save an individual Gradient/Solid/Outline folder style or follow the global style. Share palette, style and artwork resolution between previews and owned Windows folder metadata.
- Accept **USD to TRY** and **EUR** as one-unit currency queries, alongside explicit amounts and local unit conversion. Rates retain their published reference date and offline/error labeling; they are not streaming market quotes.
- Improve command/application favorites guidance and prevent stationary-pointer hover from stealing keyboard selection.
- Widen scanner cards, wrap long names and provide readable, expandable startup commands with large-text support.
- Preserve AI-tool grouping, manual assignments, Linux app discovery and reversible file organization.

[Installation and troubleshooting](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/UPDATES.md) · [Validation](https://github.com/Huseyinhk61/DarkDesk/blob/main/docs/VALIDATION.md)
