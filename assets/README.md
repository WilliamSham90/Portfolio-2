# assets/

Shared media for the whole OS — put a file here once and any widget or
app can reference it, instead of every app keeping its own copies.

- `images/` — icons, wallpapers, screenshots, etc.
- `music/` — audio files
- `fonts/` — font files, including the theme fonts described in the root
  README's "Theme fonts" section
- `pdf/` — documents
- `videos/` — video files

## Referencing a file from here

Where the path needs to be written *relative to* depends on what kind of
file is doing the referencing. That's not arbitrary — it's because
`loader.js` fetches every widget's/app's `index.html` as text and injects
it into the one real page (see root README), so a relative path in HTML
resolves differently than one in CSS or JS:

| From a...     | Write the path relative to...                                  | Example (from `apps/hello-world/`)                                |
|----------------|------------------------------------------------------------------|--------------------------------------------------------------------|
| `index.css`    | that CSS file itself (normal browser behavior)                   | `url('../../assets/images/bg.jpg')`                                |
| `index.html`   | the site root — it ends up inlined into the top-level page        | `<img src="./assets/images/icon.png">`                             |
| `index.js`     | build it off `import.meta.url` — works at any folder depth *and* any deploy subpath (e.g. GitHub Pages) | `new URL('../../assets/images/icon.png', import.meta.url)`         |
| root files (`index.html`, `main.js`, `theme.js`) | the root, same as always | `./assets/images/icon.png` |

If in doubt: CSS "just works" with a normal relative path. HTML needs a
root-relative-style path since it's inlined into the top-level document,
not loaded as its own page. JS should use `import.meta.url` rather than a
hand-written relative string, so it can't silently break if a file moves
or the site gets deployed under a subpath.
