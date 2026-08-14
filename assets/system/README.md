# assets/system/

Icons, images, and other media used to *build* the OS itself — window
chrome, cursors, backgrounds baked into a theme, etc. — as opposed to the
other `assets/` subfolders, which are the user-facing media library the
File Explorer browses.

**This folder is intentionally invisible to the File Explorer.** It has
no entry in the Explorer's sidebar and nothing here belongs in
`assets/manifest.js` — that's what keeps it hidden, there's no separate
"hidden" flag to set. See root `README.md` > "Assets" for how the
Explorer decides what it can show.

Reference a file from here exactly like anywhere else under `assets/`
(see `assets/README.md`), e.g. from a widget's `index.css`:
`url('../../assets/system/cursor.png')`.
