# Publishing the GitHub repository

This guide covers repository-owner settings that are separate from the files committed to Git.

## Make the repository public

An owner or administrator can open [Settings → General](https://github.com/Huseyinhk61/DarkDesk/settings), scroll to **Danger Zone → Change repository visibility**, choose **Make public**, and complete GitHub's confirmation. A successful visibility change is not implied by pushing a commit or setting the app's public update provider.

Alternatively, with a recent GitHub CLI authenticated as a repository administrator:

```sh
gh repo edit Huseyinhk61/DarkDesk --visibility public --accept-visibility-change-consequences
```

Verify that the repository page and release downloads open in a signed-out/private browser window. This also establishes that the public in-app updater can access the release source. Existing 3.4.1 installations need a one-time manual upgrade to the public-feed build; see [UPDATES.md](UPDATES.md).

## About panel

Use the gear beside **About** on the repository homepage:

- **Description:** A local-first desktop organizer with smart groups, workspace profiles, native app icons and reversible file operations.
- **Website:** `https://github.com/Huseyinhk61/DarkDesk#readme`
- **Topics:** `desktop-organizer`, `electron`, `react`, `windows`, `productivity`, `local-first`, `desktop-customization`, `file-management`

The README supplies the English landing page, screenshots, feature overview, download links, and documentation index. Issue forms and pull-request templates are also in English.

## Social preview

Under **Settings → General → Social preview**, upload [social-preview.png](assets/social-preview.png). GitHub stores this preview separately from the README; committing the image alone does not change the social card. Its 1280×640 image is rendered from the project's English SVG banner.

## Releases and community settings

- Keep **Issues** enabled for the English bug and feature forms.
- Enable **Private vulnerability reporting** under the repository's security settings to offer a private report channel. See [SECURITY.md](../SECURITY.md).
- Check the **Windows Installer** workflow after pushing a new version. It publishes a release only after the required build and artifact checks succeed.
- Release descriptions use the English notes in `.github/RELEASE_NOTES.md`.
- Choose a license before describing the project as open source or granting redistribution rights. No license has been selected automatically.

The `"private": true` field at the top level of `package.json` prevents accidental npm publication. It is independent of GitHub visibility and should stay enabled for this desktop app. The `build.publish[].private` setting controls the update source instead.
