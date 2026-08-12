# my-os — architecture notes

## How it fits together

```
Portfolio/
├── index.html              OS shell only: wallpaper canvas + bottom taskbar
├── main.css                 layout/size tokens + DEFAULT color/font tokens
├── main.js                  the "kernel": app registry, boots widgets, wires the taskbar
├── loader.js                shared engine used by everything below (see next section)
├── theme.js                  the "theme kernel" — applies a theme's colors/font to :root
│
├── themes/                  theme DATA only (colors + a font choice), no logic
│   ├── fonts.css             @font-face declarations for every theme's font
│   ├── fonts/                 (you add the actual font files here — see "Theme fonts")
│   ├── dial-up-dream.js       default theme
│   ├── millennium-brick.js
│   ├── fated-dusk.js
│   ├── red-october.js
│   ├── paradise-protocol.js
│   └── krystal-core.js
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
    ├── hello-world/            first app — same 3-file shape as a widget
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    └── themes/                 lets the user pick a theme (see below)
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

## Theming

Every color/font a widget or app uses is a CSS custom property declared in
`main.css` (`--rose`, `--font-main`, etc.) — nothing new there. What's new
is that those values can be swapped as a set at runtime:

- Each file in `themes/` exports one plain object: an `id`, a display
  `name`, a `fonts.display` choice (with a safe fallback stack), and a
  `colors` map — one hex value per token `main.css` declares. No logic,
  just data, so adding a 7th theme later is "copy a file, change the
  values, add one import in `theme.js`."
- `theme.js` is the only thing that reads them. `initTheme()` runs first
  thing in `main.js`'s `boot()`, applies the saved theme (`localStorage`,
  falls back to Dial-Up Dream) by writing every color straight onto
  `:root` as the *same* custom properties `main.css` already defines —
  so every existing widget/app re-skins with zero changes. Five of the
  colors (pearl/rose/hotrose/aqua/lilac — the ones used in translucent
  gradients/glows) also get an auto-derived `--x-rgb` triplet so
  `rgba(var(--hotrose-rgb), 0.3)` works without hand-maintaining a second
  copy of every accent color.
- `apps/themes/` is a normal app: it lists every theme (`listThemes()`)
  as a card previewing that theme's own gradient/swatches/font, and
  clicking one fires `document.dispatchEvent(new CustomEvent('os:set-theme', ...))`
  — the same loose "fire an event, kernel handles it" pattern `os:launch-app`
  already uses. `theme.js` listens for that event, applies the theme, and
  broadcasts `os:theme-changed` so any open Themes windows update their
  "active" state together.

### Theme fonts

Font files aren't bundled (no license to redistribute them), so on a
fresh checkout every theme just falls back to a safe system font — the OS
still looks right, just less distinctive. `themes/fonts.css` already has
the `@font-face` rules wired up; a browser only fetches a font file the
moment it's actually needed to render text, so it's safe that all six are
declared up front — only the active theme's font ever downloads.

To make a theme use its real font: download the family (all free on
[Google Fonts](https://fonts.google.com)), and drop the files into
`themes/fonts/<family-slug>/<family-slug>-<weight>.woff2` (a `.ttf` next
to it works too — `fonts.css` tries `.woff2` first, falls back to `.ttf`).

| Theme | Font | Weights needed | Folder |
|---|---|---|---|
| Dial-Up Dream | Quicksand | 400, 700 | `themes/fonts/quicksand/` |
| Millennium Brick | Chakra Petch | 400, 700 | `themes/fonts/chakra-petch/` |
| Fated Dusk | Cinzel | 400, 700 | `themes/fonts/cinzel/` |
| Red October | Bebas Neue | 400 only (it has no bold) | `themes/fonts/bebas-neue/` |
| Paradise Protocol | Space Grotesk | 400, 700 | `themes/fonts/space-grotesk/` |
| Krystal Core | Orbitron | 400, 700 | `themes/fonts/orbitron/` |

e.g. for Dial-Up Dream you'd end up with
`themes/fonts/quicksand/quicksand-400.woff2` and
`themes/fonts/quicksand/quicksand-700.woff2`. That's it — no code changes,
`fonts.css` already points at those exact paths.

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

## Icon grid: dragging to reposition

- `widget/app-grid/index.js` places every icon on the grid explicitly
  (inline `grid-row`/`grid-column`, computed from a per-app "slot" index)
  instead of relying on DOM order, so any icon can be parked in any cell.
- Dragging is Pointer Events, same approach as the window titlebar: a
  6px movement threshold tells a tap from a drag (so clicking still opens
  the app, including via keyboard), the dragged icon follows the pointer
  via `transform` + `requestAnimationFrame`, and any in-flight animation
  frame is cancelled on release so a stale frame can't re-apply itself
  after the drop.
- The grid stays invisible at rest. While a drag is in flight, the cell
  under the pointer gets a highlight box — dashed if empty, solid
  rose if it already holds an icon (drop there to swap the two).
  Landing on an empty cell just relocates the icon; landing on an
  occupied one swaps both, each animated into place with a small
  FLIP-style transition.
- Layout is per-browser (`localStorage`), keyed by app id, so a new app
  added to `APPS` just gets appended to the first free slot instead of
  disturbing anyone's arrangement.
- A `ResizeObserver` recomputes the column count on resize (or mobile
  orientation change) and re-lays out every icon accordingly.

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
