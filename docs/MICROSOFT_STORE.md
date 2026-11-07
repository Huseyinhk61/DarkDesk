# Microsoft Store submission

DarkDesk includes a separate x64 AppX build for Windows 10 (19041+) and Windows 11. This is a submission preparation workflow, **not a Store approval or a published listing**. Windows/Linux GitHub installers continue to use their existing update channels.

## Identity and package

1. Reserve the product in Microsoft Partner Center. Copy the exact **Package Identity Name**, **Publisher (CN=...)**, and **Publisher Display Name** from Product identity. These are not signing secrets.
2. Copy `build/store-identity.example.json` to `build/store-identity.local.json`, replace the placeholders, then run `npm ci`, `npm run check:store`, and `npm run dist:store` on Windows. The command refuses placeholder or missing identity values. The local identity file and signing certificates are ignored by Git.
3. Alternatively run **Microsoft Store review package** in GitHub Actions using the three identity inputs. Download the AppX artifact. It is an unsigned review/submission package; do not disable Windows signature checking to install it.
4. Review `AppxManifest.xml`, identity, version, assets, declared languages and `runFullTrust`/`internetClient` capabilities. Electron requires `runFullTrust` because DarkDesk performs user-approved filesystem operations and desktop integration. Explain this restricted capability to Microsoft during submission. Store acceptance is not guaranteed.
5. Run Windows App Certification Kit on the final package, then test a signed package on a clean Windows 10/11 standard-user account: first launch, scan, organization preview/undo, tray/exit, shortcuts, widgets, network failures, uninstall and upgrade. No Store identity or certificate was available in the cloud test environment; Store installation and certification remain release-owner checks.

The Store edition detects `process.windowsStore`, disables GitHub installer downloads/self-updates, and directs users to Microsoft Store updates. Store owns installation and updates. The GitHub Setup edition remains separate. Do not run two editions against the same desktop simultaneously; export/backup preferences before migration and verify the Store edition's data location.

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
