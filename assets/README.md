# assets/

Shared media for the whole OS — put a file here once and any widget or
app can reference it, instead of every app keeping its own copies.

- `images/` — icons, wallpapers, screenshots, etc.
- `music/` — audio files
- `fonts/` — font files, including the theme fonts described in the root
  README's "Theme fonts" section
- `pdf/` — documents
- `videos/` — video files
- `system/` — icons/images used to build the OS's *own* chrome, not user
  media. Deliberately excluded from the File Explorer — see its own
  README for why and how that exclusion actually works.

Adding a file to `images/`/`music/`/`videos/`/`pdf/`/`fonts/` makes it
*findable*, not automatically *visible* — the File Explorer app can't ask
a static server "what's in this folder" (no backend, no directory
listing), so it reads `assets/manifest.js` instead. Drop a file in the
right subfolder, then add one line to that manifest (see the comments in
the file, or root README > "Folders") so it shows up in the Explorer too.

## Referencing a file from here

Where the path needs to be written *relative to* depends on what kind of
file is doing the referencing. That's not arbitrary — it's because
`loader.js` fetches every widget's/app's `index.html` as text and injects
it into the one real page (see root README), so a relative path in HTML
resolves differently than one in CSS or JS:

| From a...     | Write the path relative to...                                  | Example                                |
|----------------|------------------------------------------------------------------|--------------------------------------------------------------------|
| any `.css` file    | that CSS file itself (normal browser behavior)                   | `url('../../assets/images/bg.jpg')` from `apps/hello-world/index.css`; `url('../assets/images/bg.jpg')` from `css/main.css` |
| `index.html` (root only — the only HTML file outside a widget/app folder) | the site root | `<img src="./assets/images/icon.png">` |
| any `.js` file (a widget's/app's `index.js`, or the kernel modules in `js/`) | build it off `import.meta.url` — works at any folder depth *and* any deploy subpath (e.g. GitHub Pages) | `new URL('../../assets/images/icon.png', import.meta.url)` from `apps/hello-world/index.js`; `new URL('../assets/images/icon.png', import.meta.url)` from `js/theme.js` |

If in doubt: CSS "just works" with a normal relative path. HTML needs a
root-relative-style path since it's inlined into the top-level document,
not loaded as its own page. JS should use `import.meta.url` rather than a
hand-written relative string, so it can't silently break if a file moves
or the site gets deployed under a subpath.
