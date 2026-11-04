# Organizing files, displaying icons, and explaining apps

## Organizing files on disk

1. Scan your desktop, or discover installed applications in **System Scanner**.
2. Select cards and check each item's target category. The heading shows selected and total counts and the scanned source.
3. Choose **Organize Desktop** to preview destinations. Confirm the proposed moves, copies, or shortcut creation.
4. Review the actual action counts in the result panel. Open target folders or undo the latest operation from there.

Selecting a category or dragging a card to another group does not move its file. Installed executables stay in place; DarkDesk creates working shortcuts in category folders. Your own desktop files and shortcuts follow the move/copy preference in Settings.

Folder-icon decoration or timestamp-preservation failures do not block a successful file move; the result shows a warning. Critical copy, verification, journal, or deletion failures are reported explicitly. If the source cannot be removed, both the source and verified copy are retained. Existing destinations are never overwritten. Result details explain skipped items; check for an existing file with the same name.

![Operation results in the interactive browser demo](assets/result.png)

## If an application logo is missing

**Refresh icons** clears cached temporary failures. On Windows, DarkDesk tries a shortcut's custom icon file and index, executable icon resources, and local `IconFile` entries in `.url` files. If native resource extraction fails, it tries the Electron shell icon. If no source is accessible, an initials fallback appears; DarkDesk does not present it as the original logo.

The browser demo cannot access operating-system icons. Initials in the README screenshots reflect this limitation. Newly created shortcuts to installed apps preserve their original icons unless the user explicitly selects a custom icon. Folder icon packs are a separate preference from application identity.

## What does this app do?

Cards and the details panel show descriptions for applications recognized by the local catalog. For example, Visual Studio Code supports writing code, Chrome opens web pages, and Blender creates 3D content. Catalog matching uses names and targets; it does not verify executable identity.

Unrecognized items receive a clearly labeled estimate based on file type or category. DarkDesk does not read file contents or call an online AI service to create these descriptions. User assignments and custom rules take priority over automatic classification. Search matches purpose descriptions as well as application names.
