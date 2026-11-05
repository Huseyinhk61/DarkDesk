## DarkDesk 3.7.1

Download **DarkDesk-Setup-3.7.1.exe** for installation and in-app updates, or **DarkDesk-Portable-3.7.1.exe** for portable use. Checksums are available in SHA256SUMS.txt.

### Changes

- Compact CPU/RAM, note and task widgets, with persistent collapse controls. CPU details include per-core samples and a memory percentage bar; collapsed monitors pause polling.
- Keep expanded geometry and note/task content when collapsing, resetting positions, hiding, or restarting. Existing oversized positions migrate into compact bounds.
- Separate native appearance events from widget content saves, preventing stale preferences from replacing recent theme/color choices.
- Give Windows folder artwork immutable, content-addressed resource paths so Explorer can distinguish changed colors, gradients and styles. Existing journal ownership and custom-folder protections remain in place.
- Improve custom-color accent contrast, header hit areas, task wrapping, preview density and small-window spacing.

Startup management is Windows-only. Physical folder icon styling uses Windows Explorer; browser previews do not modify local folders. All existing 3.7.0 productivity tools remain available.
