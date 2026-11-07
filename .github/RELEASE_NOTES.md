## DarkDesk 3.12.1 — Connected weather and verified Store downloads

### Downloads

- **DarkDesk-Setup-3.12.1.exe**: Windows installation and in-app updates.
- **DarkDesk-Portable-3.12.1.exe**: Windows Portable; update manually.
- **DarkDesk-3.12.1-x86_64.AppImage**: Linux with AppImage updates.
- **DarkDesk-3.12.1-amd64.deb**: Ubuntu/Debian; update manually.
- **SHA256SUMS.txt**: package/update metadata checksums.

### Activate online weather

The native window entry now recognizes the Weather widget instead of opening the main application inside its frame. Open **Desktop Widgets**, choose a **Weather city**, then open the weather panel. Native desktop requests and browser preview use the same fixed MET Norway forecast service, with application identification, bounded responses and no API key. Choose Celsius/Fahrenheit in Weather settings. Refresh manually, see the retrieval time, or let the widget retry a failed connection automatically. Stale fallback readings are explicitly labeled; unknown readings are never invented. Forecasts are not live weather-station observations.

The provider remains **MET Norway**, CC BY 4.0. Only manually selected coordinates are sent. An independent **Live weather connectivity** workflow checks real provider access; service/UI tests use controlled responses. Developer preview honors configured proxies. Cloud access still requires `api.met.no` in that environment's effective network policy; a saved draft alone does not apply the change.

### Store files you can download directly

The separate [Store submission release](https://github.com/Huseyinhk61/DarkDesk/releases/tag/store-v3.12.1) provides a standalone **DarkDesk-Store-3.12.1-x64.appx** and **DarkDesk-Store-Submission-3.12.1-x64.zip**. These public assets avoid the Actions-artifact login requirement. The ZIP contains four flat, nonempty files: AppX, checksum, identity verification report and extraction/upload instructions. Its extracted payloads must match their source SHA-256 values before publishing.

For Partner Center upload the **AppX**. GitHub's automatic **Source code (zip)** contains project sources and is not a Store package. The Store bundle uses the configured `HseyinKahveci.DarkDesk` identity. This is an unsigned submission package, with Store approval/certification still required. The Store prerelease does not replace the stable application update feed.

All 3.12.0 features remain: 34 icons, seven folder styles, saved currency pairs/default conversion target, paged fixed widgets, all detected drives, editable Default Mode shortcut and beta German/French/Spanish core translations.
