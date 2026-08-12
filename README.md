# my-os — architecture notes

## How it fits together

```
Portfolio/
├── index.html              OS shell only: wallpaper canvas + bottom taskbar
├── main.css                 all theme tokens (colors/fonts/sizes) — edit here to re-skin everything
├── main.js                  the "kernel": app registry, boots widgets, wires the taskbar
├── loader.js                shared engine used by everything below (see next section)
│
├── widget/
│   ├── app-grid/             icon grid widget — sits on top of the desktop
│   │   ├── index.html
│   │   ├── index.css
│   │   └── index.js
│   └── popup/                 the "window" chrome an app opens inside
│       ├── index.html
│       ├── index.css
│       └── index.js
│
└── apps/
    └── hello-world/            first app — same 3-file shape as a widget
        ├── index.html
        ├── index.css
        └── index.js
```

Every widget and every app is the same shape: a folder with `index.html`
(markup), `index.css` (its own look), `index.js` (its own behavior,
exporting an `init(container, ...args)` function). `loader.js` is the one
shared piece of "kernel" code that knows how to load any of them — no
iframes involved:

1. fetches the folder's `index.html` and injects it into a container
2. links the folder's `index.css` once (even if that folder gets loaded
   more than once, e.g. two popups)
3. `import()`s the folder's `index.js` as an ES module and calls its
   `init()` with the container

Each `index.css` wraps its rules in `@scope (...) { }`, so a widget or
app's styles can never leak out and affect anything else on the page —
that's the CSS `@scope` at-rule, which reached full cross-browser support
in early 2026, so it's a solid modern alternative to Shadow DOM or BEM
naming for this.

## How opening an app actually happens

1. `main.js` boots `widget/app-grid/`, handing it the list of installed apps.
2. Clicking an icon fires a plain DOM event: `os:launch-app`.
3. `main.js` catches that event and loads a **fresh instance** of
   `widget/popup/` into `#popup-layer` (so you can have several windows
   open at once).
4. `widget/popup/index.js` sets its own title/close button, then calls
   `loadWidget()` again — this time on the app's own folder — to fetch
   that app's `index.html`/`index.css`/`index.js` into the window's body.

## Adding a new app later

1. Duplicate `apps/hello-world/` → `apps/your-app/`.
2. Build it — it's just a normal self-contained HTML/CSS/JS page fragment.
3. Add one line to the `APPS` array at the top of `main.js`:
   ```js
   { id: 'your-app', name: 'Your App', icon: '✨', path: './apps/your-app/' }
   ```
That's it — no other file needs to change.

## Running it

Because everything is loaded with `fetch()`, this needs to be served over
a real `http(s)://` address, not opened directly as a `file://` path —
browsers block `fetch()`/`import()` of local files for security. Double-
clicking `index.html` will not work.

**GitHub Pages (no installs needed) — this is the target anyway:**

1. Create a new **public** repository on github.com (Pages' free tier requires public).
2. On the repo page: **Add file → Upload files**, then drag in everything
   *inside* the `Portfolio` folder (`index.html`, `main.css`, `main.js`,
   `loader.js`, the `widget/` folder, the `apps/` folder) — not the
   `Portfolio` folder itself, its contents, so `index.html` ends up at
   the repo root. Commit the changes.
3. Go to **Settings → Pages**. Under "Build and deployment", set
   **Source: Deploy from a branch**, branch **main**, folder **/(root)**. Save.
4. Wait about a minute, then visit `https://<your-username>.github.io/<repo-name>/`.

Every time you upload new/changed files and commit, the live site updates
within about a minute — that's your test loop.

If you ever want faster local iteration without pushing every change,
installing VS Code + its free "Live Server" extension (one click, no
command line) is the standard way — but it's optional, not required.

## Windows: dragging + taskbar tabs

- `widget/popup/index.js` makes each window's titlebar draggable with
  Pointer Events. While dragging it moves via a CSS `transform` (cheap
  for the browser — no layout/paint per pixel), and only "bakes" that
  into real `left`/`top` on release. Dragging is clamped so a window can
  never end up partially off-screen or hidden behind the taskbar.
- Clicking anywhere on a window (or its taskbar tab) raises its z-index
  above every other window and fires a `popup:activated` event.
- `main.js` listens for that event and keeps one `.taskbar-tab` button in
  `#taskbar-tabs` per open window, highlighting whichever one is active
  and removing the tab automatically when that window is closed.

## Roadmap (not built yet, on purpose)

- **Mobile OS mode**: `main.css` already isolates all sizing into tokens
  and the shell is a single flex column, so a mobile layout can likely be
  a second stylesheet + a small breakpoint/JS check later, without
  touching any widget or app.
- **Minimize**: clicking a window's own taskbar tab currently just
  refocuses it. Making it toggle hide/show when the window is already
  active would be the natural next step, in `main.js`'s tab click handler.
