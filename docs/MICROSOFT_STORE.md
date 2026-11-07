# Microsoft Store submission

DarkDesk includes a separate x64 AppX build for Windows 10 (19041+) and Windows 11. This is a submission preparation workflow, **not a Store approval or a published listing**. Windows/Linux GitHub installers continue to use their existing update channels.

## Identity and package

The owner supplied these public Partner Center values, now saved in `build/store-identity.json`:

- Package Identity Name: `HseyinKahveci.DarkDesk`
- Publisher: `CN=50E56BFE-2CBC-43B2-B893-E523B134632E`
- Publisher Display Name / app display name: `DarkDesk`

1. Verify the values against **Product identity** in Partner Center before submission. They are identifiers, not signing secrets. No certificate or Microsoft account credential is committed.
2. On Windows run `npm ci`, `npm run check:store`, then `npm run dist:store`. The committed identity is used by default. For another reserved product, copy `build/store-identity.example.json` to `build/store-identity.local.json` and replace every placeholder, or set `DARKDESK_STORE_IDENTITY` to a JSON file. Explicit invalid/missing overrides fail rather than falling back to another publisher.
3. Prefer the public [Store submission release](https://github.com/Huseyinhk61/DarkDesk/releases/tag/store-v3.12.1). Download **DarkDesk-Store-3.12.1-x64.appx** directly, or **DarkDesk-Store-Submission-3.12.1-x64.zip** and extract it. GitHub login is not required for these release assets. **Do not download the automatically generated Source code (zip)** for a Store submission. Actions artifacts remain a signed-in fallback. This is an unsigned submission package; normal end users should use the stable Setup EXE until Store approval.
4. The Windows verification script opens the final archive and checks exact identity/publisher/version, x64, executable, declared languages, branded tile assets and `runFullTrust`/`internetClient`. Electron requires `runFullTrust` for user-approved filesystem operations and desktop integration. Branded package tiles are generated from `public/icon.svg`; listing screenshots/artwork are reviewed separately. Store acceptance is not guaranteed by these checks.
5. Upload the AppX to the reserved product's submission in Partner Center. Complete listing, privacy/support links and age rating; review restricted capabilities. Run Windows App Certification Kit and test a signed package on a clean Windows 10/11 standard-user account: first launch, scan, preview/undo, tray/exit, shortcuts, widgets, startup management, automation, filesystem/registry behavior outside the package, offline errors, uninstall and upgrade. **Signing/Store installation, certification and Microsoft's approval remain owner checks.**

### Full-trust capability explanation for submission

DarkDesk is an Electron desktop organizer. It needs full-trust desktop APIs to scan user desktop/application shortcuts, preview and carry out user-selected move/copy operations, create category folders, undo its changes, manage profile visibility, register keyboard shortcuts and display editable desktop widgets. Installed applications remain at their installation paths. Optional startup/automation and system actions are controlled by the user and remain subject to OS permissions. DarkDesk does not silently request elevation, require an account, send file lists to a DarkDesk server, or replace Microsoft Store updates with a third-party installer.

The Store edition detects `process.windowsStore`, disables GitHub installer downloads/self-updates, and directs users to Microsoft Store updates. Store owns installation and updates. The GitHub Setup edition remains separate. Do not run two editions against the same desktop simultaneously; export/backup preferences before migration and verify the Store edition's data location.

## Download and upload

- [Direct AppX](https://github.com/Huseyinhk61/DarkDesk/releases/download/store-v3.12.1/DarkDesk-Store-3.12.1-x64.appx)
- [Verified Store ZIP](https://github.com/Huseyinhk61/DarkDesk/releases/download/store-v3.12.1/DarkDesk-Store-Submission-3.12.1-x64.zip)
- [ZIP SHA-256](https://github.com/Huseyinhk61/DarkDesk/releases/download/store-v3.12.1/DarkDesk-Store-Submission-3.12.1-x64.zip.sha256)

These files appear after the Store workflow succeeds. The standard ZIP is checked by reopening it, extracting each file and comparing hashes against the original source. Its flat layout contains the AppX, `SHA256SUMS-Store.txt`, `store-validation.json` and `README-STORE.txt`. A missing/empty/mismatched file fails the build.

For a local ZIP check in Windows PowerShell:

```powershell
Get-FileHash .\DarkDesk-Store-Submission-3.12.1-x64.zip -Algorithm SHA256
```

Compare the hash with the downloaded `.zip.sha256`. Extract the ZIP, then upload **DarkDesk-Store-3.12.1-x64.appx** under **Partner Center → Apps and games → DarkDesk → Submission → Packages**. Complete listing, privacy, age-rating and certification requirements. The workflow does not sign in to Partner Center or publish the listing. The `store-v…` release is marked prerelease and excluded from normal application updates.

If a download is 0 bytes, discard that incomplete download and use the explicit AppX/ZIP asset links above. An HTML login page or source archive is not an AppX package. The original Actions output was listed as 219 MB; this does not establish the content of an individual failed browser download.

## Listing draft (English)

**Title:** DarkDesk

**Short description:** Organize your desktop into smart groups, switch workspaces and keep useful tools close at hand.

**Description:** DarkDesk helps you review and organize desktop files with reversible operations, customizable folder styles, workspace profiles, a keyboard launcher, currency conversion and compact widgets for notes, tasks, focus, weather and system readings. Installed applications remain in their installation directories; DarkDesk creates shortcuts after you review the plan. File scanning and notes work locally. Currency and weather need an internet connection. Reference exchange rates are not trading prices. Weather is a forecast provided by MET Norway (CC BY 4.0).

**Category suggestion:** Productivity / Utilities.

**Language disclosure:** Turkish and English are the primary languages. German, French and Spanish are beta translations of the core interface; advanced help may appear in English. Disclose this in corresponding localized listings until translation review is complete.

**Privacy URL:** publish `docs/PRIVACY.md` at a stable public HTTPS URL (the repository's public document URL can be used for review; verify Partner Center's current requirements).

## Submission checklist

- Replace identity placeholders; validate final publisher/signature against Partner Center.
- Supply required Store logos, current screenshots, localized listing copy, support/privacy links and IARC age rating. Existing generated package logos are a starting point; inspect their crops on tiles.
- Explain `runFullTrust`, file moves/undo, optional background operation, OS commands and optional third-party network requests to reviewers.
- Verify accessibility: keyboard-only navigation, visible focus, high contrast, text scaling and screen-reader names; review beta translations with native speakers.
- Verify that Store packages cannot offer a GitHub installer update. Do not embed repository access tokens or signing passwords.
- Complete Windows certification and Store review before announcing Store availability.
