## DarkDesk 3.12.0 — Your tools, your workspace

### Downloads

- **DarkDesk-Setup-3.12.0.exe**: Windows installation with in-app updates.
- **DarkDesk-Portable-3.12.0.exe**: Windows Portable; update manually.
- **DarkDesk-3.12.0-x86_64.AppImage**: Linux with AppImage updates.
- **DarkDesk-3.12.0-amd64.deb**: Ubuntu/Debian; update manually.
- **SHA256SUMS.txt**: package/update metadata checksums.

### More personal, easier to use

Choose from **34 icons** across the five existing packs and **seven folder styles**: Gradient, Solid, Outline, Pastel, Glass, Neon and Paper. Open **Categories & Rules → Customize** for a category, or expand **Global folder theme** for the default style. Save/apply updates Windows category folders and interface previews; personal icon metadata is protected. Physical folder artwork remains Windows-only.

In **Currency Converter**, choose a pair and pin it, remove unwanted pairs, and set **Default currency in Quick Launcher**. The choice persists across windows and restarts. `1 usd` uses that target; `1 usd tl` and `50 eur to gbp` specify another. The launcher guide shows short examples. Frankfurter supplies dated institutional reference rates, not streaming trading quotes.

### Fixed, readable widgets

Notes and tasks use pages, without vertical widget scrolling. Full content stays saved; text is never truncated in storage. System Monitor shows every detected disk and pages between them, including unavailable volumes. Opacity controls change the shared background rather than dimming text; inner forms no longer cover it with opaque panels. Focus settings have separate timing/sound views. Blur remains fixed.

The **Weather** widget is opt-in and free, with no API key. Select a city or enter coordinates and choose Celsius/Fahrenheit. Forecasts are provided by **MET Norway**, CC BY 4.0. Manual location avoids automatic GPS/IP geolocation. A 15-minute cache and bounded requests reduce traffic; unavailable data is reported rather than fabricated. Live provider access was blocked by this cloud environment's network policy; response parsing, caching, offline behavior and UI were tested with controlled data.

### Shortcuts, systems and languages

**Ctrl+Alt+0** returns to Default Mode. Change it in **Work Profiles → Global shortcuts**, with the same key recorder and collision protection as the launcher. **Alt+X** remains the launcher default.

Windows system commands use fixed native adapters; audio and Wi-Fi failures provide clearer guidance. Linux discovers available PipeWire/PulseAudio, session lock, Wi-Fi and screenshot providers; macOS offers native audio/screenshot adapters. Commands requiring unavailable hardware/session permissions remain unavailable. Night Light and cleanup commands open the operating system's supported settings instead of claiming to apply undocumented toggles.

German, French and Spanish are **beta core-interface translations**. Turkish and English remain the complete primary languages; advanced guidance may fall back to English. Automation/settings layouts now use clearer spacing and safer independent preference saves.

### Microsoft Store preparation

A separate **AppX** configuration, identity validator, manual GitHub build workflow, privacy notice and submission checklist are included. Store packages use Store-managed updates rather than GitHub installers. A Partner Center identity, signed installation test, Windows certification and Microsoft review are still required. **No Microsoft Store listing is published by this release.**
