# GitHub push errors and Windows release failures

## `Internal Server Error` or `fatal error in commit_refs`

This error means the remote Git service could not complete its branch-reference update. It can occur after upload and authentication have already succeeded. It does not identify a particular problem in DarkDesk's application code.

In the November 4, 2026 investigation, public repository access, fetch, a dry-run push, and local Git integrity checks all succeeded. Actual pushes initially failed at the remote reference-update stage. A later ordinary push succeeded. These observations do not distinguish an incident inside GitHub from a problem in the managed cloud Git connection, and do not establish that changing repository visibility caused the failure.

If it happens again:

1. Check that you are in the repository folder and run `git status`.
2. Preserve local changes, synchronize with `git pull --ff-only`, and retry `git push origin main` normally.
3. If the problem occurs only in the cloud session, refresh its GitHub repository connection or reopen the repository in a new cloud session. An owner can also try a normal push from their authenticated Windows checkout.
4. If the same server error occurs from the owner's own checkout, check GitHub Status and contact GitHub support with the error's Request ID and timestamp.

## GitHub API `Forbidden`

The cloud environment's HTTP policy did not allow `api.github.com`, although public `github.com` pages and Git operations were available. API access is separate from repository visibility and Git write access. Environment API access must be configured through its supported network settings; opening a repository to the public does not grant an API permission or change that policy.

## No EXE or `latest.yml` returns 404

Release publication requires the **Windows Installer** workflow to finish. A failed Windows unit test stops packaging and release publication; a source-code push alone does not produce a download.

Two icon-test portability problems were fixed: a real Windows shell icon could preempt a mocked Electron icon, and equivalent forward/backslash paths were compared as different strings. Remote Windows unit tests subsequently passed. The native smoke test then exposed an equivalent-path comparison: Windows expanded an 8.3 user-directory alias to its long name. The shortcut target and icon are now both compared with `fs.realpath`, preserving the identity check. The CI reporters now add unit and native failed-test diagnostics to workflow annotations so the failure is easier to inspect. Test results from a Linux workstation do not establish that the Windows workflow passed.

Open [Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/workflows/windows.yml) and inspect the latest run. Once packaging and publication both succeed, check [Releases](https://github.com/Huseyinhk61/DarkDesk/releases/latest) for the EXEs and update metadata. See [UPDATES.md](UPDATES.md) for the publication process.

## Verified outcome

The ordinary push retry succeeded. The [Windows publish run](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41824868352) and [Test & Build run](https://github.com/Huseyinhk61/DarkDesk/actions/runs/41826147065) subsequently passed. [v3.4.3](https://github.com/Huseyinhk61/DarkDesk/releases/tag/v3.4.3) now contains public Setup/Portable EXEs, checksums and update metadata. The remote native test verifies real Windows file operations and application IPC; it does not run a human GUI installation or a live update from an older installed version.
