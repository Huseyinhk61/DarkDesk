# Folder colors and styles

DarkDesk supports preset colors, custom HEX colors, and two-color gradients for category folders. Changing the application palette, interface icon pack, or font does not require changing folder colors. Original application logos and existing file icons are preserved.

## Choose a folder appearance

1. Right-click a Smart Group to open its editor, or use **Color & style**. You can also open **Categories & Rules** and edit a category or create a subgroup.
2. Choose its glyph and one of ten preset colors: Blue, Purple, Green, Orange, Slate, Pink, Cyan, Teal, Amber, or Red. Alternatively, use **Custom color & gradient** to pick any start and end color.
3. Enter six-digit HEX values such as `#2255ee` and `#dd3388`, use the native color inputs, or select Aurora, Ocean, Sunset, Forest, Rose, or Graphite. **Use a single color** makes both ends match. Invalid HEX values cannot be saved.
4. Choose a Small, Standard or Large folder glyph, then save the category. Its card accents, icon background, and folder preview update. On Windows, DarkDesk also applies saved visual changes to existing category folders whose icon metadata it owns.
5. In **Folder appearance**, choose the global **Gradient**, **Solid**, or **Outline** style. In an individual category editor, **Style for this folder** overrides it for that category. Select **Use global style** to follow later global changes again. Each group retains its own color and glyph. Gradient uses both custom colors; Solid uses the start color. New Windows category folders receive the chosen appearance when you organize files into them.

The same validated SVG artwork powers interface previews and Windows folder icons. Ten preset colors use 360 bundled assets: three styles × ten colors × twelve glyphs. Custom colors are rendered locally into matching PNG-backed ICOs, without downloading artwork. Native folder artwork is distinct from the five interface icon packs. Choosing a preset color or **Restore preset color** clears the custom gradient.

![Three folder styles](assets/folder-themes-en.png)

![Custom HEX colors, gradient palettes, and live preview](assets/custom-colors-en.png)

## Apply to existing Windows folders

Saving a visual category change in the Windows desktop app updates existing DarkDesk-owned category folder icons automatically. To refresh explicitly or retry a failed update, open **Folder appearance** in **Categories & Rules** or **Automation & Settings**, then choose **Apply to desktop folders**. Both paths update appearance only: they do not organize, move, copy, delete, or launch folder contents, or create missing category folders automatically. Use a group’s explicit **Create folder and apply appearance** action to create its configured folder and apply its saved style. That action affects only the selected category and does not organize files.

DarkDesk writes its `.darkdesk.ico` and `desktop.ini` metadata and the Explorer attributes needed to display the icon. It recognizes its own earlier metadata from operation history or its local appearance record. Manually customized or unrecognized icon metadata is skipped rather than overwritten. Symlinked or unverifiable paths are also skipped. No automatic elevation is requested.

The result shows how many folders were **updated**, **unchanged**, **skipped**, or **failed**. Expand the details to see why a folder was skipped or could not be updated:

| Result                                       | What to do                                                                                            |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| Category folder not created                  | Use the group’s create/apply action, or organize an item into it when ready.                          |
| Custom icon files preserved                  | Keep the existing custom icon, or manage that customization yourself in File Explorer.                |
| Windows denied access                        | Check your access to that folder and retry when it is writable.                                       |
| Icon file changed or path cannot be verified | Check the folder in File Explorer before retrying.                                                    |
| Appearance information could not be read     | Keep the local appearance record and operation history; inspect the error before making more changes. |

Explorer may cache an older icon. DarkDesk asks Explorer to refresh; if that refresh cannot complete, the result suggests opening the folder and pressing **F5**. The interface preview changes immediately; Explorer may take longer to redraw a physical desktop icon.

## File undo and appearance changes

Folder appearance is a visual preference, separate from file-operation undo. If you organize files, apply a newer folder style, and then undo the file organization, the files return while the newer style is preserved. An empty styled folder can remain after that undo because its newer appearance metadata is retained. Inspect and remove an empty folder yourself if you no longer need it.

Changing a category's label, folder name, or parent does not rename existing physical folders. **Apply to desktop folders** targets the category's current configured path. Review folder paths when editing an established hierarchy.

## Platform support

Native folder appearance is supported in the **Windows Electron desktop app**. Browser previews and other platforms display the same interface previews, but their apply control is unavailable. Browser mode does not access your desktop. Existing application shortcuts continue to use their original logos unless you explicitly assign a custom shortcut icon.
