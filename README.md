# my-os — architecture notes

## How it fits together

```
Portfolio/
├── index.html              OS shell only: wallpaper canvas + bottom taskbar — the
│                            only HTML file, and only file left loose at the root
├── README.md
│
├── css/
│   ├── main.css              layout/size tokens + DEFAULT color/font tokens
│   └── malware.css           NotAVirus.exe's popups — only loaded once it's run (see "NotAVirus.exe")
│
├── js/                      the "kernel" — everything OS-shell-level that isn't a
│   │                        widget/app (see "Adding a new app later")
│   ├── main.js                app registry, boots widgets, wires the taskbar
│   ├── loader.js              shared engine used by every widget/app (see next section)
│   ├── theme.js                the "theme kernel" — applies a theme's colors/font to :root
│   ├── folders.js              the "folders kernel" — desktop folders are virtual (see "Folders")
│   ├── context-menu.js         replaces the right-click menu (see "Right-click menu")
│   ├── confirm-dialog.js        themed window.confirm() replacement, used before deleting a folder
│   ├── icon.js                  isImageIcon() — one shared image-vs-emoji icon check (see "Icons")
│   ├── icon-style.js             the "icon style kernel" — blue/yellow folder icons (see "Icons")
│   ├── wallpaper.js             the "wallpaper kernel" — desktop background photo (see "Wallpaper")
│   ├── start-menu.js             the taskbar's Start button + its dropdown (see "Start menu")
│   ├── power.js                  the shut-down/boot-up overlay (see "Start menu")
│   ├── clock-panel.js             taskbar clock + its slide-in date/calendar panel (see "Taskbar clock")
│   ├── taskbar.js                 the open-window tab strip (see "Taskbar tabs")
│   ├── download-file.js            saves a Blob to the visitor's own computer (see "Notepad")
│   ├── notifications.js             the toast + its taskbar history dropdown (see "Notifications")
│   ├── welcome.js                   fires the one-time greeting notification (see "Notifications")
│   └── malware.js                   NotAVirus.exe's popup "infection" — loaded on demand (see "NotAVirus.exe")
│
├── themes/                  theme DATA only (colors + a font choice), no logic
│   ├── fonts.css             @font-face declarations for every theme's font
│   ├── dial-up-dream.js
│   ├── millennium-brick.js
│   ├── fated-dusk.js
│   ├── red-october.js         default theme
│   ├── paradise-protocol.js
│   └── krystal-core.js
│
├── assets/                  shared media the whole OS can use (see "Assets")
│   ├── manifest.js           registry of files the File Explorer can browse
│   ├── images/
│   │   └── Background Images/  the 11 wallpaper photos (see "Wallpaper") — also a
│   │       │                    regular Explorer album (manifest.js), not exclusive
│   │       │                    to the desktop wallpaper picker
│   │       └── thumbs/           small copies for the Settings picker, same file names
│   ├── music/
│   ├── fonts/                (theme font files go here — see "Theme fonts")
│   ├── pdf/
│   ├── videos/
│   └── system/
│       └── Icons/              OS-chrome icons, deliberately NOT shown in the Explorer (see "Icons")
│           ├── basic/            app-icon placeholders, the start button, power buttons, file types
│           ├── blue folders/     one of the two selectable folder-icon packs
│           └── yellow folders/   the other — default (see "Icons")
│
├── games/                   the Flash games: each .swf + its cover image (see "Games")
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
    ├── calculator/             standard, chained-evaluation calculator (see "Calculator")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── notepad/                 one always-there note, asks before closing unsaved (see "Notepad")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── paint/                   the 16-tool MS-Paint-style editor (see "Paint")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── themes/                 folder name unchanged, but this is now "Settings" —
    │   │                        theme + icon style (see "Theming" and "Icons")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── file-explorer/           "My Computer" — browses folders + /assets (see "Folders")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── media-viewer/             opened by file-explorer when an image is clicked (see "Folders")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── flash-player/             plays one games/*.swf in its window, via Ruffle (see "Games")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── music/                    music player for assets/music, spinning-record cover (see "Music")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── malware/                  NotAVirus.exe — the demo "malware", in the Malware folder (see "NotAVirus.exe")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── browser/                  iframe + address bar (see "Adding a new app later")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    ├── system-info/               Start Menu only, not on the desktop — not in APPS (see "System Info")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    └── terminal/                 Start Menu only, not on the desktop — not in APPS (see "Terminal")
        ├── index.html
        ├── index.css
        └── index.js
```

Every widget and every app is the same shape: a folder with `index.html`
(markup), `index.css` (its own look), `index.js` (its own behavior,
exporting an `init(container, ...args)` function). `js/loader.js` is the
one shared piece of "kernel" code that knows how to load any of them — no
iframes involved:

1. fetches the folder's `index.html` and injects it into a container
2. links the folder's `index.css` once (even if that folder gets loaded
   more than once, e.g. two popups) — and actually *waits* for it to
   finish loading, the first time, before going any further. That matters:
   without it, the very first time a folder's stylesheet loads, an
   `init()` that measures its own layout (a popup window centering/
   clamping itself before its content has arrived, say) can run before
   that CSS has applied and get a wrong, unstyled measurement — a real
   bug this surfaced once, not a hypothetical one.
3. `import()`s the folder's `index.js` as an ES module and calls its
   `init()` with the container — the module downloads *alongside* steps
   1–2 rather than after them (one round trip on an app's first open, not
   two), which is safe because no `index.js` touches the page at import
   time, only inside `init()`. Keep it that way in any new app.

`index.html`'s `<head>` also lists every module `js/main.js` imports at
boot (plus `widget/app-grid`'s files) as `<link rel="modulepreload">` /
`preload` hints, so the browser fetches the whole boot graph at once
instead of discovering it one `import` level at a time — the no-build-step
version of what a bundler does. They're only hints: a module missing from
that list still loads, just later, so add new boot-time imports there too.

Each `index.css` wraps its rules in `@scope (...) { }`, so a widget or
app's styles can never leak out and affect anything else on the page —
that's the CSS `@scope` at-rule, which reached full cross-browser support
in early 2026, so it's a solid modern alternative to Shadow DOM or BEM
naming for this.

## How opening an app actually happens

1. `js/main.js` boots `widget/app-grid/`, handing it the list of installed apps.
2. Clicking an icon fires a plain DOM event: `os:launch-app`.
3. `js/main.js` catches that event and loads a **fresh instance** of
   `widget/popup/` into `#popup-layer` (so you can have several windows
   open at once).
4. `widget/popup/index.js` sets its own title (and, next to it, the
   app's own icon — `.popup-icon`, same `isImageIcon()` image-or-emoji
   check `js/icon.js` centralizes for every other icon in this OS) and
   close button, then calls `loadWidget()` again — this time on the app's
   own folder — to fetch that app's `index.html`/`index.css`/`index.js`
   into the window's body.
5. If that app's `init()` returns `{ beforeClose }`, the close button
   awaits it before actually closing — the one way an app can step in
   front of its own window closing (Notepad's unsaved-changes prompt is
   the only one that does, see "Notepad"). This has to come back from
   `init()` itself, not a plain export sitting next to it, since a module
   is a singleton (one `apps/notepad/index.js` instance shared by every
   window that ever opens it) but each window needs its *own* `dirty`
   flag — `loadWidget()` (`js/loader.js`) passes `init()`'s return value
   back up as `initResult` specifically so this can exist at all.

## Theming

This is the "Theme" half of the **Settings** app (`apps/themes/` — the
folder wasn't renamed, only the app's `name`/`id` in `APPS`, since it's
still fundamentally the same theme-picking code, just with "Icon Style"
and "Wallpaper" sections added alongside it now — see "Icons" and
"Wallpaper"). Every color/font a widget or app uses is a CSS custom
property declared in
`css/main.css` (`--rose`, `--font-main`, etc.) — nothing new there. What's
new is that those values can be swapped as a set at runtime:

- Each file in `themes/` exports one plain object: an `id`, a display
  `name`, a `fonts.display` choice (with a safe fallback stack), and a
  `colors` map — one hex value per token `css/main.css` declares. No
  logic, just data, so adding a 7th theme later is "copy a file, change
  the values, add one import in `js/theme.js`."
- `js/theme.js` is the only thing that reads them. `initTheme()` runs
  first thing in `js/main.js`'s `boot()`, applies the saved theme
  (`localStorage`, falls back to Red October) by writing every color
  straight onto `:root` as the *same* custom properties `css/main.css`
  already defines — so every existing widget/app re-skins with zero
  changes. Five of the colors (pearl/rose/hotrose/aqua/lilac — the ones
  used in translucent gradients/glows) also get an auto-derived
  `--x-rgb` triplet so `rgba(var(--hotrose-rgb), 0.3)` works without
  hand-maintaining a second copy of every accent color.
- `apps/themes/` is a normal app: it lists every theme (`listThemes()`)
  as a card previewing that theme's own gradient/swatches/font, and
  clicking one fires `document.dispatchEvent(new CustomEvent('os:set-theme', ...))`
  — the same loose "fire an event, kernel handles it" pattern `os:launch-app`
  already uses. `js/theme.js` listens for that event, applies the theme,
  and broadcasts `os:theme-changed` so any open Themes windows update
  their "active" state together.
- **A theme's `hotrose` needs to work as *text*, not just as a glow.**
  It's the one accent color used both ways — a translucent glow over dark
  surfaces (`rgba(var(--hotrose-rgb), 0.3)`-style, all over the desktop)
  *and* solid, as accent text/borders over a theme's own light surfaces
  (`--win-bg`/`--paper`, e.g. `apps/system-info`'s key labels). Dial-Up
  Dream's original `hotrose` (`#eeb24a`, a pale butter-yellow) was picked
  looking only at the first case — gorgeous as a glow, but ~1.1:1 contrast
  against that theme's own `--win-bg` as text, i.e. functionally invisible
  (WCAG AA wants 4.5:1). Fixed by darkening it to a deeper amber
  (`#6b3208`, ~5:1) — still glows warm on dark backgrounds, now actually
  readable as text too. Worth checking both contexts for any future
  theme's `hotrose`, not just how it looks as a glow.

### Theme fonts

Every theme's font is downloaded and in place. `themes/fonts.css` has the
`@font-face` rules pointing at the exact files below; a browser only
fetches one the moment it's actually needed to render text, so it's safe
that all six are declared up front — only the active theme's font ever
downloads. (Two themes ended up with a different font than originally
planned, since the exact family wasn't available/downloaded — Millennium
Brick and Red October below.)

| Theme | Font | Weights used | Folder |
|---|---|---|---|
| Dial-Up Dream | Quicksand | 400, 700 | `assets/fonts/Quicksand/` |
| Millennium Brick | Space Mono | 400, 700 | `assets/fonts/SpaceMono/` |
| Fated Dusk | Cinzel | 400, 700 | `assets/fonts/cinzel/` |
| Red October *(default)* | Architects Daughter | 400 only (it has no bold) | `assets/fonts/ArchitectsDaughter/` |
| Paradise Protocol | Space Grotesk | 400, 700 | `assets/fonts/SpaceGrotesk/` |
| Krystal Core | Orbitron | 400, 700 | `assets/fonts/orbitron/` |

Chromium may log a console warning like `glyf: Glyph bbox was incorrect;
adjusting` for the Architects Daughter file — that's the browser silently
correcting bad bounding-box data baked into that particular `.ttf` at
export time, not something `@font-face`/CSS controls. It's non-fatal (the
glyph still renders correctly) and safe to ignore; the only real fix is a
re-exported/re-downloaded copy of the font file itself.

Folder casing matters and is inconsistent on purpose — it's whatever each
family's download actually used (`cinzel`/`orbitron` lowercase,
`Quicksand`/`SpaceGrotesk`/`SpaceMono`/`ArchitectsDaughter` not). Windows
won't notice a mismatch here, but GitHub Pages (Linux) will 404, so if
you re-download or rename a family, keep `fonts.css`'s `url(...)` paths
byte-for-byte matched to the real folder/file names.

`themes/fonts.css` serves each of these as `.woff2` — converted from the
`.ttf` beside it (fontTools), about 60% smaller over the wire; the `.ttf`
files are just the sources now. To add a 7th theme's font (or swap one of
these): put a `.woff2` (convert a `.ttf` with fontTools, or download the
woff2 directly) anywhere under `assets/fonts/`, add matching `@font-face`
rules to `themes/fonts.css`, and point that theme's `fonts.display.family`
(in its file under `/themes`) at the family name you used.

## Icons

Every icon in this OS is either a plain emoji glyph or a path to a real
image under `assets/system/Icons/` — `js/icon.js`'s one-line
`isImageIcon()` is how every place that draws an icon (`widget/app-grid`,
the taskbar, `js/context-menu.js`, `apps/file-explorer`, `js/start-menu.js`)
tells which it's looking at and renders an `<img>` instead of a `<span>`
accordingly, rather than each of them needing their own check or an extra
flag threaded through the data.

- **App icons** are set per app in `APPS` (`js/main.js`): `settings.png`,
  `computer-storage.png`, `calculator.png`, `earth.png` (**Browser**,
  fixed — no more per-browser-detected icon). Every desktop app has a
  real icon of its own now — `add.png` isn't used as a placeholder
  anywhere currently, though it's still there for the next app that
  needs one before its real icon exists.
- Every icon `<img>` is written with `draggable="false"` — without it, a
  browser's own native image-drag (the "drag to save/copy this picture"
  gesture, on by default for every `<img>`) fights the desktop's own
  pointer-based drag-to-reposition system for the same gesture, and wins:
  the icon never actually moves. Real bug, hit once when the desktop grid's
  emoji glyphs first became `<img>`s — any *new* icon `<img>` needs this
  attribute too, not just the ones on the desktop grid itself, since it's
  cheap insurance against the same class of bug anywhere else an icon
  might one day become draggable content.
- **Folder icons** are the one style-*switchable* icon — `js/icon-style.js`
  (same shared-kernel shape as `js/theme.js`) owns whether `assets/system/Icons/blue folders/`
  or `yellow folders/` is active (default **yellow**), persists it, and
  fires `os:icon-style-changed` for `widget/app-grid` and
  `apps/file-explorer` to redraw every folder icon on. Only the plain
  "folder" icon is actually wired up to draw anything right now, but
  `icon-style.js`'s `PAIRS` table maps every *other* icon in both packs to
  its counterpart in the other one too, so wiring up a new one later (a
  locked folder, say) is one `styledIconUrl('lockedFolder')` call, not a
  new lookup table. The packs aren't quite symmetric — blue's
  `favourite-folder.png` (a star) and yellow's `smiley.png` don't look
  alike but are paired as the same "type" of icon anyway (called out in
  the file); `calendar.png` (blue) and `notes.png` (yellow) have no
  counterpart in the other pack at all, so they're left out of `PAIRS`
  entirely.
- Picked from the **Icon Style** section of the Settings app (same
  active-indicator-card pattern as the theme picker just above it).
- **Every icon file is stored at 128×128** (`power-button green.png`,
  shown at 64px, at 192) — 3× the largest size any icon is drawn at, so
  still sharp on high-density phone screens — as palette-quantized PNGs
  (the pngquant technique: same `.png` names, alpha intact) of ~11 KB
  each, down from 512px originals of ~130 KB each. A new icon should be
  sized the same way; a 512px one works, it's just ~10× heavier.

## Wallpaper

`js/wallpaper.js` (same shared-kernel shape as `theme.js`/`icon-style.js`)
owns the desktop's background photo — one of the eleven files under
`assets/images/Background Images/`, or **None**, which isn't a special
case threaded through the module but a real entry whose `file` is `null`
— falling back to `--desktop-gradient` (`css/main.css`, factored out into
its own token specifically so the "None" card in the picker and the
desktop itself can share the exact same value rather than the picker
re-implementing what "no wallpaper" looks like). Default is **City
Night** (`City Night.webp`).

- Applying a choice is one `setProperty('--wallpaper-image', ...)` call
  on `:root`, read by `#desktop-wallpaper` — a dedicated absolutely-
  positioned layer painted over `#desktop`'s own gradient background
  (not `#desktop`'s `background-image` directly), so the two don't have
  to be juggled as one `background` shorthand with matching layer counts
  for `background-size`/`position` between the "photo" and "no photo"
  states.
- **Loaded once, on purpose.** The URL for a given wallpaper is always
  built the same way — `new URL(file, import.meta.url).href`, no
  cache-busting query string, same pattern every other asset URL in this
  codebase uses — so setting `--wallpaper-image` to a choice already
  showing, or shown earlier this session, is a browser HTTP cache hit,
  never a second fetch. There's nothing to track here to make that true;
  it's just what a stable URL gets you for free.
- The Settings app's **Wallpaper** section lists all twelve options
  (`listWallpapers()`) as cards with a real photo thumbnail each — except
  **None**, which previews `--desktop-gradient` directly rather than
  fetching an image for something that has no photo to show. Each
  thumbnail is a small copy of its photo in `Background Images/thumbs/`
  (same file name, 320px wide, 3–13 KB) rather than the full photo scaled
  down by the `<img>` — before those existed, opening Settings downloaded
  every full-size wallpaper just to draw the cards (~40 MB at the time).
  Adding a wallpaper therefore means two files: the photo, and its
  `thumbs/` copy.
- The full-size photos are capped at 2560px wide (WebP, quality 82) —
  plenty for a `cover`-scaled background on any common screen. The
  originals were 4–8K photos of 2–7 MB each, which also cost real decode
  time and memory every time one was applied.
- The same eleven photos are also a regular **Background Images** album
  under Images in `apps/file-explorer` (`assets/manifest.js`) — browsable
  and openable in `apps/media-viewer` like any other album, independent
  of the wallpaper picker; the two just happen to point at the same
  folder, one file list kept in sync by hand in two places
  (`js/wallpaper.js` and `assets/manifest.js`) since a static site can't
  read a folder's contents to generate either one automatically.

## Assets

`assets/` is shared media any widget or app can use — `images/`, `music/`,
`fonts/`, `pdf/`, `videos/`, `system/`. Each subfolder has its own short
README. The one thing worth knowing: because `js/loader.js` inlines every
widget's and app's `index.html` into the one real page, a relative path
behaves differently depending on where it's written from (CSS vs. HTML
vs. JS). `assets/README.md` has the full breakdown and examples — read it
before wiring up the first image/font/audio reference from inside a
widget/app.

`assets/manifest.js` is a separate, related thing: the list of files the
**File Explorer app** can browse (see "Folders" below). A static site has
no way to ask "what's in this folder", so — same as `APPS` in
`js/main.js` — files are listed by hand rather than discovered
automatically. `assets/system/` is the one subfolder deliberately left
out of both the Explorer's categories and this manifest — it's for the
OS's own chrome, not user-browsable media.

## Folders

Desktop folders and the File Explorer ("My Computer") work together:

- A folder is virtual — `{id, name, appIds}`, plus two optional fields
  most folders don't have (`icon`, and `locked`/`unlocked` — see below) —
  since this is a static site with no backend to create a real one on
  disk. `js/folders.js` (same shared-kernel pattern as `js/theme.js`) is
  the only thing that reads/writes them, via `localStorage`. Any change
  fires `os:folders-changed` on `document`, so the desktop and every open
  File Explorer window can re-render themselves. Which actual icon *file*
  a folder is drawn with still comes from `js/icon-style.js` (see "Icons"
  above) — a folder just optionally names *which* icon (`folder.icon`, a
  `PAIRS` key there — normal folders have none, which defaults to the
  plain generic one), so switching icon style re-skins every folder at
  once regardless.
- **Three folders every fresh desktop starts with**: **Locked** (empty),
  **Malware**, holding NotAVirus.exe (see "NotAVirus.exe"), and
  **Games**, holding the four Flash games (see "Games") —
  `js/folders.js`'s `DEFAULT_FOLDERS`, used whole when nothing's been
  saved yet (a first-ever visit, or right after Reset), so genuinely
  deleting one of these sticks like any other delete would.
  A default folder added *later* — Games, for anyone whose folders were
  already saved before it existed — is handed to that visitor once:
  `os-folders-seeded` records which defaults a browser has been given
  (a saved list from before that key existed counts as having had Locked
  and Malware), `load()` adds any it hasn't, and the next `save()` marks
  them given, so deleting Games afterwards still sticks too. An app added
  to a folder a visitor *already has* works the same way, through
  `DEFAULT_FILINGS` (NotAVirus.exe into Malware): filed once, unless that
  folder's been deleted or the app's already filed elsewhere, and never
  forced back if it's moved out afterwards. **Locked**
  needs a password (`12345678`,
  `unlockFolder()`) the first time it's opened — `apps/file-explorer`
  prompts for it automatically the moment the folder is selected (desktop
  icon or sidebar, either one), via `js/password-dialog.js` (a second
  `confirmDialog()`-shaped dialog, reusing its exact `.confirm-dialog*`
  CSS, just with a password `<input>` and an inline error for a wrong
  guess — retried in a loop until it's right or cancelled). Getting it
  right sets `folder.unlocked = true` and persists that, so it only ever
  has to be entered once, not once per visit; Reset clears it back to
  locked along with everything else. **Malware** isn't actually
  malware — it holds the OS's harmless demo "malware" (NotAVirus.exe),
  with room for more education-focused content later.
- Folders live as regular icons on the desktop grid, right alongside
  apps — `widget/app-grid` asks `js/folders.js` for the current list and
  draws them with the exact same draggable/swappable icon it already
  uses for apps (see "Icon grid" below). Clicking one fires
  `os:open-folder` instead of `os:launch-app`; `js/main.js` catches that
  and opens **My Computer** straight into that folder.
- **Filing an app away**: drag an app icon and drop it *onto* a folder
  icon (same drag system as reordering — dropping onto an occupied cell
  already means "something happens here", this is just the folder case
  of that). The app fades out and disappears from the desktop; it's now
  only reachable from inside that folder. Each folder's view in the
  Explorer lists what's inside with a small ✕ to move an app back out.
- **Renaming a folder**: creating one (right-click → New Folder) drops it
  straight into an inline rename — type a name, Enter/click-away commits,
  Escape cancels — same as double-clicking a folder's name on a real OS.
  You can rename it again anytime via right-click → Rename. The rename
  box is a floating overlay positioned over the icon's label rather than
  an `<input>` nested inside the icon's `<button>` — the latter is invalid
  HTML and browsers get flaky about focus/selection when you do it anyway
  (see `startRename()` in `widget/app-grid/index.js`).
- **Deleting a folder**: right-click → Delete asks for confirmation first
  (`js/confirm-dialog.js` — a themed stand-in for `window.confirm()`,
  since a bare browser dialog would clash with the rest of the UI) and mentions
  how many apps are inside, if any. Deleting doesn't touch what was filed
  inside it — `deleteFolder()` just removes the folder itself, and since
  the desktop only ever *excludes* an app because some existing folder's
  `appIds` claims it (see `visibleItems()` in `widget/app-grid`), every
  app that was inside reappears on the desktop on its own, no extra
  "move it back" step needed.
- **My Computer** is a completely ordinary app (`apps/file-explorer/`, in
  `APPS` like any other) — draggable, filable into a folder, etc. It's a
  two-pane window: a left sidebar lists your folders and the read-only
  `assets/` library (Images/Music/Videos/PDF, from `assets/manifest.js` —
  Fonts is deliberately left out of this list; see "Theme fonts", the
  underlying font files and theme mechanism are untouched, they're just
  not something to browse here); clicking one shows its contents on the right,
  as either a grid (default) or a list — the toggle button, top-right of
  that pane, remembers nothing between openings on purpose, it's a small
  per-window preference, not worth a `localStorage` key. A category entry
  can also be an **album** (`kind: 'album'` in `assets/manifest.js`,
  images-only so far but not images-specific) — it shows as a folder row;
  opening it shows just its own files, same rendering as a category.
  Clicking a PDF/video file opens it in a new tab and lets the browser's
  own viewer handle it. **Music** plays in the Music app instead (see
  "Music"), each song shown with its cover art — any manifest entry can
  name a `cover` image to be its icon here. **Images** get the fullest
  handling: each row/cell shows the actual
  picture as its icon (not a generic 🖼️), and clicking one opens
  `apps/media-viewer/` — a small in-OS lightbox with prev/next through
  whatever list it was opened from (an album or a category's flat files).
  It's intentionally simple (no filmstrip/filtering) — a fuller
  custom-skinned viewer is still a separate, later pass. The window title
  updates as you step through images (it reaches up to its own
  `.popup-title` via `container.closest('.popup-window')` — there's no
  generic "app renames its own window" event since nothing else has
  needed one) so it never goes stale showing whichever image was
  originally clicked.
- Deliberately out of scope for now (all easy to add later, on top of
  the same pieces above): nested folders (albums are one level, on
  purpose) and a custom-skinned video player.

## Right-click menu

`js/context-menu.js` swaps the browser's native right-click menu for the
OS's own, everywhere on the page. What it shows depends on the target:
right-clicking a folder icon gets Open/Rename/Delete; anywhere else gets
the general desktop menu (New Folder / My Computer / Settings / Reset
Desktop — Settings launches the Settings app, `apps/themes/`). New
Folder's own icon comes from `js/icon-style.js` too, read fresh each time
the menu opens (`desktopItems()` is a function, not a static array, for
exactly that reason) so it's never stale after switching icon style. To
add a menu item, add one `{icon, label, run}` entry to `desktopItems()`
(or `folderItems()`) in `js/context-menu.js` — same shape as `APPS` in
`js/main.js`.

**Reset Desktop** asks for confirmation, then wipes every piece of user
customization — theme, folders, icon positions, and a NotAVirus.exe
"infection" (see "NotAVirus.exe") — back to first-boot defaults and
reloads the page. Each piece of state stays owned by its own
module (`js/theme.js`, `js/folders.js`, `widget/app-grid`); Reset doesn't
reach into any of them directly, it just dispatches `os:reset` on
`document` and each one clears its own `localStorage` key in response —
same loose-coupling pattern as everything else here, and it means a
future module with its own persisted state only has to add its own
listener, no changes needed anywhere else.

A right-click that something under the cursor already handled with its
own menu (`event.defaultPrevented` — a Flash game's Ruffle player does
this, see "Games") is left alone too, so the two menus never stack.

**Shift+right-click still opens the real browser menu** — the handler
checks `event.shiftKey` and simply doesn't call `preventDefault()` when
it's held, so the native menu (Inspect, etc.) opens exactly as normal.
That's the only thing touched; keyboard devtools shortcuts (F12,
Ctrl+Shift+I) were never intercepted in the first place.

## Notifications

`js/notifications.js` is a small notification center, not a one-off
welcome banner — `notify({id, title, text})` shows the toast (top-right,
same slide-in-from-the-edge treatment `.clock-panel` uses: `hidden`
toggled off, a forced reflow, *then* the class that starts the
`transform` transition — see "Taskbar clock" for why that order matters)
*and* records it into a persisted history list, which the taskbar's bell
button (`notification.png`, beside the clock) lists — clicking a past
entry there just shows that same toast again, it doesn't add a new
history entry, since it's the same notification recurring, not a new
occurrence of it. `js/welcome.js` is the one thing that calls `notify()`
today; anything that wants to notify the user later goes through this
same module rather than rolling its own toast.

- **No auto-dismiss timer, on purpose.** A real user closed a genuinely
  9-second-lived version of this before it had a chance to actually be
  read — the "helpful" auto-hide was working against the one thing a
  greeting is *for*. It closes when its own ✕ is clicked, full stop.
  `role="status"` rather than `role="alert"`, though — a notification is
  worth mentioning, not worth interrupting anything for.
- **"First visit" isn't its own flag** — `js/welcome.js` just checks
  whether `'welcome'` is already in `listHistory()`; no separate
  `localStorage` key, and so no separate `os:reset` listener either.
  Reset Desktop already clears the *whole* history (`notifications.js`'s
  own key), which is what makes a reset genuinely return this to "brand
  new" too, not just visually — a real first visit finding the history
  empty and a post-reset one finding it freshly emptied are the exact
  same check, so there's only one `if` to write.
- The history entries themselves persist (`localStorage`,
  `os-notification-history`) — deduplicated by `id`, so a notification
  that's fired more than once only ever appears once in the list (moved
  to reflect its latest occurrence, not stacked as a duplicate).
- Each row in the bell menu has its own ✕ to delete just that entry, for
  when the list gets long — same `.taskbar-group-row`/`-close` shape the
  taskbar's grouped-tab dropdown already uses (a sibling button next to
  the row's main one, not nested inside it, since buttons can't nest).

## Start menu

`js/start-menu.js` is the taskbar's left-side Start button (`home.png`,
transparent until hovered/active — a `.taskbar-divider` beside it in
`index.html` is what actually marks the split from the open-window tabs,
now that the button has no resting-state border/background of its own to
imply it) and its dropdown. It's initialized as `initStartMenu(START_MENU_ITEMS)` from
`js/main.js`'s `boot()` — receiving the list as a parameter rather than
importing it back from `main.js` itself, since `main.js` already imports
`start-menu.js`; importing it the other way round would be a circular
import, and depending on evaluation order could hit that list before its
`const` is initialized. `START_MENU_ITEMS` (`js/main.js`) is a specific,
curated, *ordered* list — **My Computer, Browser, Games, Music,
Terminal, Settings, System Info** — not `APPS` itself: this exact
list/order was requested directly, so a desktop-only app (Calculator)
stays off it unless asked for. **System Info** and **Terminal** aren't
desktop icons at all, so they're not in `APPS` (which also drives the
desktop grid); `js/main.js` keeps a second list, `ALL_APPS`, for
`os:launch-app` to resolve an id against — otherwise clicking one in
the menu would fire the same event every other app click does, and
`main.js` wouldn't be able to find it.

**Games** isn't an app but the desktop's Games folder: any id in the
list that isn't an app becomes `{ folderId }`, and the menu shows that
folder — opening it the same way its desktop icon does (`os:open-folder`).
The menu is rebuilt every time it opens rather than once at boot, so that
entry always matches the folder itself: renamed, re-iconed by the Icon
Style setting (blue/yellow `game-folder.png`), or left out entirely once
the folder's been deleted. Each entry uses the same icon-or-emoji
rendering as everywhere else (`js/icon.js`); a Power off button sits at
the bottom. It closes on outside-click, Escape, or launching something.

**Power off** (`js/power.js`) asks for confirmation first
(`js/confirm-dialog.js`, same as deleting a folder), then shows
`#power-overlay` — a fixed, full-viewport black div (`z-index: 1300`, above
everything else including the confirm dialog) that fades in over its own
opacity transition rather than appearing instantly. On it, a single pulsing
green power button (`power-button green.png`). Clicking that button plays a
small boot sequence: a fixed list of BIOS-style lines typed out character by
character into a `<pre>` (monospace, green-on-black, with a blinking-cursor
`::after`), then the overlay fades back out to reveal the desktop —
exactly as it was, since nothing was actually torn down, the whole thing is
just an overlay sitting on top.

## Taskbar tabs

`js/taskbar.js` owns the open-window strip between the Start button and
the clock — main.js's `openApp()` calls its one entry point,
`registerWindow(app, popupRoot)`, right after creating a window, and
everything else (which tab that becomes, what clicking it does, closing
it later) is this module's problem from there, reached back into a
window only through the same events `widget/popup/index.js` already
dispatches (`popup:focus`, `popup:toggle-minimize`) — no different from
how main.js drove tabs before, just moved into its own module now that
there's enough tab-specific behavior to justify one.

- **One icon per app, not per window** — Windows-style grouping. A
  second window of an app already open doesn't get a second tab; the
  existing one grows a small count badge instead. The icon itself is the
  only thing on the tab now (no name label anymore) — `title` **and**
  `aria-label` both carry the app's name, since a hover tooltip alone
  isn't reliably exposed to assistive tech (title's just for the visual
  hover; aria-label is what actually satisfies the accessibility need).
- **Grouped tabs open a dropdown instead of toggling directly** —
  `.taskbar-group-menu` (same glass-panel styling, and the same
  "hug the taskbar" positioning, as `.start-menu`) lists each window,
  clicking one focuses/restores that specific window. A single-window tab
  skips the dropdown entirely and just toggles that one window, same as
  before grouping existed. Each row also has its own `✕` — a sibling
  button next to the row's label, not nested inside it (a `<button>`
  can't contain another one), same split `apps/file-explorer`'s removable
  rows already use. It dispatches the exact `popup:closed` event that
  window's own titlebar ✕ would, so closing from here isn't a separate
  code path — it's indistinguishable from closing the window itself.
  Closing down to one remaining window closes the dropdown too, back to
  the plain single-tab case rather than showing a pointless one-item list.
- **A row's label isn't always just `"AppName - N"`** — an app can say
  what its own window should be called there instead, by dispatching
  `popup:label-changed` (`{ detail: { label } }`, bubbling) on its own
  outer window element (`container.closest('.popup-window')?.parentElement`
  from inside the app, the same "reach up to the chrome" trick
  `apps/media-viewer` already uses for its own title). `apps/file-explorer`
  is the one app that does, with its currently-open folder/category/album
  name (`null` at the plain "This PC" root, which falls back to "My
  Computer" same as before). `renderGroupMenu()` only numbers windows that
  land on the *same* label — three File Explorer windows on three
  different folders show three plain folder names, no numbers, while two
  windows both on "Homework" still disambiguate as `"Homework - 1"` /
  `"Homework - 2"`. One race worth knowing about: an app's very first
  render (and so its first label) can happen *before* `registerWindow()`
  has run for that window — its own `init()` finishes, and can render,
  before the outer `loadWidget()` call awaiting it returns to `main.js`,
  which is what calls `registerWindow()`. An early label isn't lost: it's
  stashed in `pendingLabels` (keyed by the window element itself, the
  only handle available before it's a registered root) and claimed the
  moment `registerWindow()` actually runs for that window.
- **Drag left/right to reorder** — Pointer Events, the same
  drag-threshold-before-it-counts-as-a-drag pattern `widget/app-grid`
  uses for icons. Unlike the grid, the reorder itself doesn't happen live
  as you drag over a neighbor — only the dragged tab moves (following the
  pointer via `transform`) while dragging; on drop, the target index is
  computed from where it landed among the *other* tabs' actual (static)
  positions, and every tab that needs to shift animates into its new spot
  at once via a multi-element FLIP (capture every tab's rect, reorder the
  DOM, animate each one's leftover delta to zero) — simpler than shifting
  neighbors live during the drag, and still reads as one smooth motion.
- **`‹`/`›` arrows for overflow** — `#taskbar-tabs` still scrolls
  natively (wheel/trackpad keeps working exactly as before), but once it
  actually overflows, arrows appear on each side a click/tap can use
  instead, each paging by 80% of the visible strip width. A
  `ResizeObserver` on the strip (not a plain `window.resize` listener)
  is what keeps the arrows' visibility in sync — deliberately, since
  what changes the strip's available width isn't only the browser window
  resizing; the clock's own date text growing by a character, say,
  shrinks `.taskbar-tabs-wrap` too, and a `window.resize` listener
  would miss that entirely.

## Taskbar clock

`#taskbar-clock-button` (`js/clock-panel.js`) is the taskbar's right edge —
time on top, date underneath, ticking every 15s (plenty for a clock with
no seconds hand). Clicking it slides `#clock-panel` in from the right
edge — a fixed panel showing the time, the full date, and a calendar.
Unlike `.start-menu`/`.context-menu`, which just pop in with `hidden`
toggled and no motion, this one actually animates: it stays in the DOM
transformed off-screen (`transform: translateX(calc(100% + 24px))`) and
slides to `translateX(0)` on open, same "toggle `hidden` off, force a
reflow, *then* add the class that starts the transition" sequence
`power.js` uses for its overlay — closing does the same in reverse, but
waits out the transition's own 300ms (a `clearTimeout`-guarded timer, so
spamming the button can't leave a stale timer hiding a panel that just
got re-opened) before setting `hidden` back, so it only leaves the a11y
tree once it's actually gone, not the moment it starts sliding away.

The calendar is browsable, not a static snapshot: `‹`/`›` step
`viewYear`/`viewMonth` (module-local state, independent of the clock's
own "now") a month at a time, rolling over into the next/previous year at
the edges for free since it's just `month -= 1; if (month < 0) { month =
11; year -= 1; }`. Every render also marks South African public holidays
— `southAfricaHolidays(year)` returns the ten fixed-date ones plus the two
Easter-based ones (Good Friday, Family Day), Good Friday/Family Day's own
date found via the Meeus/Jones/Butcher algorithm rather than a hard-coded
table (so browsing into any year, not just this one, still gets them
right), plus the "falls on a Sunday → the following Monday is also a
holiday" rule South African law adds on top. A holiday shows as a ring
around that day (`.is-holiday`, `--aqua`) rather than a filled circle like
`.is-today` (`--hotrose`) specifically so a day that's *both* still shows
both instead of one hiding the other. William's birthday (17 January,
`BIRTHDAY` in `js/clock-panel.js`) gets the same "different color" idea
applied as a *filled* circle (`.is-birthday`, `--lilac`) rather than a
ring, so it doesn't read as just another holiday — the one edge case
where it could land on the same day as `.is-today` is resolved by CSS
declaration order (`.is-today` declared last wins the tie), not JS, since
"today" is the more useful thing to see at a glance.

A holiday/birthday day's name isn't a `title` tooltip — hovering a cell
this small turned out easy to miss and fiddly to trigger on a real click
or tap, so only these cells render as a real `<button>` (a plain day is
an inert `<span>`; nothing to click through to) and clicking one opens
`#clock-panel-day-popup` with the description in it, positioned off the
clicked cell's own `getBoundingClientRect()` and clamped so it can't run
past either edge of the viewport. That element is a **sibling** of
`#clock-panel` in `index.html`, deliberately not nested inside it: a CSS
`transform` (which `#clock-panel` has, for its slide animation) turns the
transformed element into the containing block for any `position: fixed`
descendant, which would have silently broken this popup's own
viewport-relative positioning the moment the panel was mid-animation.
Navigating months, or closing the calendar panel itself, closes the day
popup too (its anchor cell is either gone or about to be), and Escape
closes just the day popup first if one's open, the whole panel on a
second press — the same "innermost thing first" pattern most nested
popups/modals use.

## System Info

**System Info** (`apps/system-info/`) is a normal app in every way except
it isn't in `APPS` (see "Start menu" above for how `js/main.js` still
resolves it) — a neofetch-styled "about me" card: profile photo
(`williampp.jpg`) and name, OS/host/role/location facts styled as
key/value rows, and a `two-hearts.png` sign-off — real bio content
dressed up as system info rather than an actual system reading anything
real. Both `williampp.jpg` and `two-hearts.png` are resolved in
`index.js` via `import.meta.url` rather than written as a plain `src` in
`index.html`, same reason every other icon does: a relative URL sitting
in static HTML resolves against the *page's* URL once that HTML is
injected, not this folder's.

## Terminal

**Terminal** (`apps/terminal/`) is another Start-Menu-only app, positioned
just above Settings there — a small fake terminal: a fixed black
background and green text regardless of the desktop theme (same call
`js/power.js`'s boot log makes, for the same reason: it's meant to look
like a real terminal, not a themed window), and every response typed out
character by character with a blinking block cursor — literally reusing
`power.js`'s boot-log `@keyframes` for that cursor, rather than
redefining the same animation twice.

- **Commands** are a plain `switch` in `index.js` — `help` (lists them),
  `sysinfo` (the same bio facts as `apps/system-info`, as plain text),
  `color <name>` (see below), and `clear`. Adding another later is one
  more `case`.
- **`color <name>`** repaints the whole terminal — prompt, past output,
  and future output alike — via one CSS custom property
  (`--term-fg`), not a per-line color. Eight fixed options, green by
  default: green, white, amber, cyan, magenta, red, blue, orange. Nothing
  here persists to `localStorage` — like Calculator and Notepad, every
  new window opens fresh (green, empty scrollback), since nothing else
  under `apps/` persists its own state either; only kernel modules
  (`js/theme.js` and the like, booted once) do that.
- The input is disabled while a response is still typing out, so a second
  command can't get entered mid-animation and have its output interleave
  with the first — same idea as Notepad's save-before-close prompt
  blocking further edits, just simpler here (nothing async to await
  permission for, just a fixed-interval `setTimeout` loop to wait out).
- **`init()` takes optional `{ color, script }`** — a starting color
  (one of the eight names above) and lines to type out, one after another,
  in place of the greeting, before the prompt unlocks as normal. Opened
  from the Start menu it gets neither and behaves exactly as above;
  NotAVirus.exe opens it with `{ color: 'red', script }` for its fake
  payload (see "NotAVirus.exe"), so that's this same app, not a copy.

## Calculator

`apps/calculator/` is a standard (non-scientific) calculator — chained
left-to-right evaluation like real Standard-mode calculators (`2 + 3 × 4`
→ `20`, not `14` — precedence/parentheses are a scientific-mode feature,
out of scope here), not an expression parser. All state (the current
entry, the pending operator, the running total) lives in `index.js`'s
closure — reset for free each time the app opens, since loader.js gives
every instance a fresh module scope, nothing to reset by hand.

- Floating-point noise (`0.1 + 0.2` → `0.30000000000000004`) is rounded
  away for *display* only (`formatNumber()`, `toPrecision(12)`) — every
  calculation itself works off the raw, unrounded number
  (`previousValue`), so display rounding never compounds across a chain
  of operations. The rounded string is also what gets re-parsed for
  further chaining, though — deliberately: showing hidden extra precision
  the user can't see would be its own kind of surprising.
- **%** matches Windows Calculator's Standard mode, not the flatter "just
  divide by 100" a simpler calculator might do: with a pending operator,
  `%` computes a percentage *of* the running total (`200 + 10%` → 10% of
  `200` → `20`, then `200 + 20`), not of the raw entry.
- Divide-by-zero and overflow (a result too large to show as a plain
  decimal) both land in the same `Error` state — `AC` is the only way
  out, same lockout a real calculator has.
- No number-key keyboard shortcuts, on purpose: real `<button>` elements
  already give correct keyboard accessibility for free (Tab, then
  Enter/Space activates one) — the actual requirement — and 0-9/+/Enter
  shortcuts would need a document-level listener scoped to "this window
  is the focused one" and torn down on close, machinery no other app here
  has, for a convenience feature rather than an accessibility one.

## Notepad

`apps/notepad/` opens blank every time — no `localStorage`, nothing
remembered between openings, on purpose. "Save" doesn't persist anything
*inside* this OS at all; it downloads the current text as a real `.txt`
file to the visitor's own computer, the same as any other browser
download. Not a multi-file editor either — "New"/"Open" would need a
virtual filesystem this OS doesn't have (folders, `js/folders.js`, only
ever hold *apps*, not documents) — that's real scope this app
deliberately doesn't take on.

- **The download itself** is `js/download-file.js`'s one function,
  `downloadFile(blob, fileName)` — a `Blob` (`text/plain;charset=utf-8`
  here) turned into an object URL, assigned to a temporary
  `<a download>`, clicked in JS, then `URL.revokeObjectURL()`'d a tick
  later rather than immediately — belt and suspenders against a browser
  that's still reading the blob URL right when it'd otherwise get pulled
  out from under it. This is the universally-supported way to do this;
  the newer File System Access API's `showSaveFilePicker()` would give a
  real "Save As" dialog (and let a second Save overwrite the same file
  without re-prompting), but neither Firefox nor Safari implement it at
  all, and a portfolio site can't assume every visitor is on Chromium.
  There's also no callback confirming a download actually finished (or
  that an OS save dialog inside it wasn't cancelled) — a caller just
  counts it as saved the moment it's triggered, same as any other
  download button would. `apps/paint` (below) shares this same module
  rather than repeating it, downloading a `.jpg` `Blob` instead of a
  `.txt` one.
- **Explicit Save only, no autosave** — there's nothing to autosave *to*
  here besides triggering a real download on every keystroke, which
  would be its own kind of chaos. The toolbar's status text (`Saved` /
  `Unsaved changes`) and a `•` appended to the window's own title while
  dirty (reaching up via `container.closest('.popup-window')`, same
  trick `apps/media-viewer` already uses to rename its own title) are
  both small, understated cues, not a blocking warning banner.
- **The toolbar Save button confirms before it downloads anything** —
  triggering a file save onto someone's real computer isn't something to
  do on a single click with no warning, so it asks first
  (`js/confirm-dialog.js` again, "Save"/"Cancel" this time). The
  `beforeClose` prompt below doesn't get a second confirmation stacked on
  top of this one, though: choosing "Save" *there* already is the
  deliberate choice this dialog exists to check for, so its own `save()`
  call skips straight to the actual download.
- **Closing with unsaved changes prompts first** — `init()` returns
  `{ beforeClose }`, which `widget/popup/index.js` awaits before actually
  closing the window (see "How opening an app actually happens", step
  5). `beforeClose()` reuses `js/confirm-dialog.js` exactly as every
  other confirmation in this OS does — "Save" downloads the `.txt` then
  closes, "Don't Save" (or dismissing the dialog entirely, same as
  clicking it) closes without downloading anything, and since nothing
  here persists on its own, that text is just gone. There's no third
  "cancel, keep editing" option: a deliberately simple two-outcome
  prompt, not a three-button one, matching `confirmDialog()`'s existing
  shape rather than extending it.
- **`note`** (the second argument `init()` accepts, `{name, content}`)
  is a placeholder for a real future feature — the File Explorer opening
  a `.txt` file straight into this editor, the same way it already opens
  images into `apps/media-viewer`. Nothing calls it with a value yet
  (there's no `.txt` entry in `assets/manifest.js` to open from), but
  accepting it now costs nothing and avoids a signature change later —
  `note.name`, once that exists, becomes the default download filename
  too (not just the starting content), so editing an opened file and
  saving offers its own name back instead of `note.txt`.

## Paint

`apps/paint/` is a small MS-Paint-style editor — all 16 tools of the
classic toolbox (select, eraser, fill, eyedropper, magnifier, pencil,
brush, airbrush, text, line, curve, rectangle, polygon, ellipse, rounded
rectangle), a native `<input type="color">` instead of a full palette +
custom-color dialog, and one Save button. Built with
[jspaint](https://github.com/1j01/jspaint) as the reference for which
tools a "real" paint program has and roughly how each behaves — not a
port of it, and deliberately simpler everywhere jspaint itself goes
further (one brush shape, no fill-style picker for shapes, Curve's a
single bend not two).

- **Two real `<canvas>` elements, stacked** — `.paint-canvas` is the
  actual artwork (what gets saved); `.paint-overlay`, exactly on top and
  `pointer-events: none` so it never intercepts input, is where every
  tool's *live preview* goes instead — a selection marquee, a shape being
  dragged out, a polygon's in-progress edges. Committing an action draws
  once onto the real canvas and clears the overlay, so nothing a preview
  draws can *ever* end up baked into the saved image — it never touches
  the canvas that gets saved, structurally, not by carefully remembering
  to erase it afterward.
- **Every tool is the same shape**: `{onDown, onMove, onUp, onDoubleClick,
  commitPending}` (`tool()` fills in whichever a given tool doesn't need
  with a no-op). `onMove(pos, isPointerDown)` fires on *every* pointer
  move, not just while dragging — nearly every tool ignores it unless
  `isPointerDown`, but Polygon's "next edge follows the cursor" preview
  specifically needs to track it between clicks, while the button's up.
  `commitPending()` finishes whatever a multi-step tool was in the middle
  of — a selection mid-move, Curve's un-bent baseline, an unclosed
  polygon, an unstamped text box — called both when switching tools and
  from `beforeClose()`, so nothing is ever silently lost.
- **Select (Rectangular / Free-Form)** drags out a marquee first; dragging
  again *from inside* that marquee is what actually cuts and moves those
  pixels (a `Path2D` — a plain rectangle for one, the traced lasso path
  for the other — `ctx.clip()`ped onto an offscreen canvas to lift just
  that region, however it's shaped). Marquee-and-never-drag genuinely
  touches nothing; the cut only happens the moment a move actually starts.
- **Curve** is a straight line first (drag once), then *one more* drag
  bends it via `quadraticCurveTo` — a single control point, not real MS
  Paint's two independent bends (`bezierCurveTo`). **Polygon** is
  click-per-vertex with a live rubber-band edge to the cursor between
  clicks, closed with a double-click.
- **Fill** is a classic iterative flood fill — an explicit stack, not
  recursion, so it can't blow the call stack on a large fill.
- **Save** — `canvas.toBlob(cb, 'image/jpeg', 0.92)` into
  `js/download-file.js`'s `downloadFile()` (see "Notepad" for how that
  works and why not the newer File System Access API). The canvas starts
  filled solid white, not left at its default transparent — JPEG has no
  alpha channel, so an untouched canvas would otherwise export as solid
  black in most browsers. Both the toolbar Save button (confirms first,
  "Save"/"Cancel") and closing with unsaved changes (`beforeClose()`,
  "Save"/"Don't Save") work exactly like `apps/notepad`'s do — see that
  section for why closing doesn't get a second confirmation stacked on
  top of an explicit toolbar Save.
- **The Magnifier** cycles 100% → 200% → 400% → 100%, applied by setting
  real `width`/`height` CSS on both canvases (not a `transform: scale()`)
  specifically so `.paint-canvas-wrap`'s `overflow: auto` actually has a
  bigger layout box to scroll — a transform changes what's *painted*, not
  the element's layout size, so scrolling to reach the edges of a zoomed
  canvas wouldn't work with one. `image-rendering: pixelated` keeps the
  enlarged pixels crisp instead of blurring them.
- **The canvas fills the window, not just its own fixed default size** —
  a `ResizeObserver` on `.paint-canvas-wrap` (same generic "react to an
  element's size changing, whatever caused it" tool `js/taskbar.js`'s
  overflow arrows already lean on, rather than anything popup-specific —
  nothing in `widget/popup/index.js` announces "the window's content area
  changed size") debounced 120ms, since dragging a window's edge fires
  this repeatedly, not once. Growing or shrinking the canvas would
  normally *clear* it (that's how a `<canvas>` element's `width`/`height`
  attributes work), so a resize actually draws the old contents onto a
  temporary canvas first and copies them back onto the resized one
  afterward — top-left anchored, so shrinking crops and growing just adds
  white space, the same as resizing a real image canvas would. Skipped
  entirely above 100% zoom: at any zoom level, the canvas is *already*
  meant to exceed the visible area (that's what zooming in means) and
  scrolls instead of fitting, so auto-fitting the underlying resolution
  to the viewport at the same time would just fight with that.

## Music

**Music** (`apps/music/`, desktop icon `music.png`) plays the songs in
`assets/music/`. They're listed in `assets/manifest.js`'s `music` array —
the same list the File Explorer's Music library shows — each with its
`cover` image, a clean `title`/`artist` (the files' own tags came from
YouTube rips and can't be trusted) and its `duration` in seconds.

- **The current song's cover is a picture-disc record** that spins while
  it plays: the art clipped to a circle with grooves, a vinyl rim and a
  spindle hole drawn over it, all turning together, while the light's
  reflection sits on a separate, still layer above it so the record
  visibly turns *under* the light. Pausing pauses the animation rather
  than removing it, so the record stops at whatever angle it reached and
  carries on from there. A blurred copy of the cover glows under it.
  Animating only `rotate` keeps it on the GPU, and
  `prefers-reduced-motion` keeps the record still.
- **Controls**: shuffle (a real Fisher–Yates shuffle of what plays after
  the current song, so nothing repeats until everything has played),
  previous (restarts the song first if it's past 3s, like any player),
  play/pause, next, repeat (off → all → one), seek, volume and mute. The
  song list underneath plays whatever's clicked, and marks the current
  song with a small level meter that moves while it plays.
- **Streaming, not downloading**: `<audio preload="none">` fetches nothing
  until play is pressed, then streams with HTTP range requests (GitHub
  Pages supports them), so a 10 MB song starts after its first few hundred
  KB. Six of the files used to carry an embedded cover (up to 856 KB of
  PNG) in the tag at the very start of the file, which the browser had to
  download before the first note; those were stripped, with the audio
  itself verified byte-for-byte unchanged.
- **One player at a time, and the OS's media controls**: starting a song
  in one Music window pauses any other, and the playing window owns the
  Media Session, so the keyboard's media keys, a phone's lock screen and
  the browser's own media controls show its song and cover and drive it.
  Closing that window stops the music and clears all of that, so a closed
  player can't keep answering the media keys.
- **From My Computer**: clicking a song (My Computer → Music) plays it in
  the Music window that's already open, bringing it to the front, rather
  than opening a second player — the Explorer fires a cancelable
  `os:play-song` event, an open Music window takes it, and only if none
  does is a new one opened (`openApp(music, [{ songId }])`).
- **Layout** follows the window, not the screen (container queries on
  `.music-app`): stacked and centred when narrow (phones), record beside
  the title at the usual window size, and record-plus-controls beside the
  song list when maximized. On touch screens the volume slider is hidden
  (phones use their volume buttons, and iOS ignores a page's volume
  anyway), buttons grow to 44px, and hover highlights are kept to devices
  that can really hover so a tapped button doesn't stay lit.
- **Colours stay readable in every theme.** The theme accent (`--hotrose`)
  is only 1.5:1 against Fated Dusk's light window, so the player uses
  `--win-accent` (`css/main.css`: `--hotrose` pulled halfway toward
  `--win-text` in oklch — each theme's own hue, at 3:1 or better in all
  six themes) and `--win-text-soft` for secondary text (4.5:1 or better
  everywhere). Both are derived from the theme rather than set by it, so
  any app drawing on a window can use them (NotAVirus.exe does).
- **Adding a song**: put the `.mp3` and a square cover image in
  `assets/music/`, then add one line to `music` in `assets/manifest.js`
  (`id`, `name` as My Computer should show it, `file`, `cover`, `title`,
  `artist`, `duration` in seconds). Nothing else changes.

## Games

Four Flash games — **Alien Hominid**, **Fleeing the Complex**,
**Pac-Man** and **The Impossible Quiz** — live in `games/` (each `.swf`
next to its cover image) and start out filed in the desktop's **Games**
folder, drawn with the icon packs' `gameFolder` icon (blue or yellow
`game-folder.png`, following the Icon Style setting like every folder).

- **Each game is an ordinary app.** `GAMES` in `js/main.js` is spread
  into `APPS`, every entry with its cover as its `icon` and the same
  `path` (`apps/flash-player/`), plus `args: [{ swf, width, height }]` —
  `openApp()` uses an app's own `args` when it's launched without
  explicit ones, which is how one player app opens four different games.
  So everything an app can do, a game can: open in a draggable/resizable
  window, get its own taskbar tab (cover as icon), be dragged out of the
  Games folder onto the desktop (the ✕ in the Explorer), or into another
  folder.
- **`apps/flash-player/`** plays the `.swf` through
  [Ruffle](https://ruffle.rs), the Flash Player emulator (WebAssembly, no
  plugin). Ruffle is ~5 MB, so it's fetched the first time a game opens —
  never at boot — from jsDelivr, pinned to an exact version (0.6.0) with
  an SRI `integrity` hash: an unpinned "latest" URL can change under the
  site without warning. jsDelivr serves it brotli-compressed and cached
  for a year, so it's a one-time download. Configured with
  `polyfills: false` (otherwise Ruffle watches every DOM change on the
  page looking for `<object>`/`<embed>` Flash content to replace),
  `autoplay: 'on'` (the click that opened the window counts as the user
  gesture browsers want before playing sound), `letterbox: 'on'` and
  `openUrlMode: 'deny'` (a game's own sponsor/"more games" links can't
  navigate this page away).
- **`init()` returns immediately** and loads the game in the background —
  `js/main.js` only wires up a window's close button and taskbar tab once
  the app's `init()` has resolved, so awaiting a multi-megabyte download
  there would leave both dead until it finished.
- **Window size**: a game window opens at the game's own shape — `width`/
  `height` in `GAMES` are the SWF's stage size, turned into the player's
  `aspect-ratio` — as big as the window's usual caps allow. Maximized or
  resized, the player fills the window exactly and Ruffle letterboxes the
  game inside it, so it's never stretched and never scrolls.
- **Minimize pauses the game** (no sound or CPU from a window you can't
  see) and restoring resumes it — unless it was already paused from
  Ruffle's own menu. **Closing** needs no code at all: removing the
  `<ruffle-player>` from the page is what tears Ruffle down, sound and all.
- **Right-click inside a game** shows Ruffle's own menu (fullscreen,
  volume, quality…) rather than the desktop one — see "Right-click menu".
  `.flash-player` is `isolation: isolate`, so Ruffle's own z-indexed
  overlays (its warnings, dialogs, that menu) stay inside the game area
  and can never cover the window's resize grip.
- **Adding a game**: drop its `.swf` and a square cover image into
  `games/`, add one line to `GAMES` (its stage size: open it once and read
  `document.querySelector('.flash-player-ruffle').ruffle().metadata` in the
  console), and add its `id` to the Games folder's `appIds` in
  `js/folders.js` — skip that and it simply appears on the desktop instead.
  GitHub rejects files over 100 MB; Fleeing the Complex is the big one,
  at 34.5 MB (Ruffle shows a progress bar while it downloads).
- Fleeing the Complex logs one CORS error in the console: its built-in
  Newgrounds sponsor intro tries to fetch a file from newgrounds.com,
  which only allows that from Newgrounds itself. The game runs fine
  without it.

## NotAVirus.exe

The OS's demo "malware" (`apps/malware/`, icon `hacker.png`), filed in the
desktop's **Malware** folder. All theatre: the only thing it ever touches
is one localStorage flag.

- **Three warnings first**, in its own small window: "Do you wish to run
  this program?" with a tiny "yes" beside a big "No"; then "Are you
  sure?" (the yes gets even smaller); then "You're really going to do
  this? Well, it's your funeral…", whose Yes stays greyed out until the
  "I acknowledge this is a bad app…" box is ticked. "No" at any step just
  closes it, and No is always the focused button, so Enter is the safe
  answer. The tiny yes is tiny *text* in a button that still meets the
  24px minimum target size, so it's still tappable.
- **The payload**: the prompt closes and a red terminal opens
  (`payload.exe`, skull icon), typing out a fake hacking script ending in
  an ASCII skull — the ordinary Terminal app opened with
  `{ color: 'red', script }` (see "Terminal"). Script lines stay within 38
  characters so nothing wraps on a phone.
- **The popups** (`js/malware.js` + `css/malware.css`): a few seconds in,
  fake ads (loud, tilted, Arial Black — and an ad's button only ever opens
  another ad) and fake error messages (dressed as this OS's own windows,
  red title bar) start appearing at random spots on the desktop, one at a
  time, each sooner than the last (1.8s apart, down to 0.4s) — 20 to 25
  of them, a different number each run, and 25 is also the most ever on
  screen at once. Then "I told you this was a bad idea." appears dead
  centre over a dimmed backdrop, with an OK and a hint that Reset Desktop
  cleans it all up. There are 25 different popups, drawn without
  repeats, so even a full wave never shows the same one twice. Every
  popup closes with its ✕ or OK, and **drags like a window** — an error
  by its title bar, an ad from anywhere but its buttons — using the very
  same `makeDraggable()` the windows use (`widget/popup/index.js`, see
  "Windows"); pressing one brings it to the front, the way clicking a
  window does. The pictures are icons from the existing set (the same
  Flaticon pack as every other icon here).
- **It sticks around**: after the wave, another popup turns up every
  8–12 minutes, on later visits too (`os-malware` in localStorage, which
  `js/main.js`'s `boot()` checks), until **Reset Desktop** — its
  `os:reset` clears the flag and stops it. Reloading an infected page
  doesn't replay the wave, only the occasional popup.
- **Later**: those every-so-often popups could become notifications
  instead — `notify()` from `js/notifications.js` (a toast plus an entry
  in the taskbar bell's history). The spot is marked in `scheduleRepeat()`
  in `js/malware.js`.
- **Cheap, including on phones**: an ordinary visit never downloads
  `js/malware.js` or `css/malware.css` — the app imports the module when it
  runs, boot imports it only when the flag says this browser's infected,
  and the stylesheet loads with the first popup (`loadStylesheet()` from
  `js/loader.js`). The popups are plain elements in one layer, not real OS
  windows: no backdrop-filter blur (25 blurred windows would cost a
  phone a lot of frames), `contain: layout style`, and only
  transform/opacity animate. Measured on a phone emulated with a 4×
  slower CPU, the whole wave held 60fps. The layer sits over every window
  but under menus and dialogs, and inside the desktop area, so the
  taskbar and Start menu stay usable throughout.
- **Known limitation**: Reset Desktop lives in the right-click menu,
  which iPhones have no gesture for (Android's long-press works), so an
  iPhone visitor can close the popups but can't cure the infection.

## Adding a new app later

1. Duplicate an existing app folder, e.g. `apps/calculator/` → `apps/your-app/`.
2. Build it — it's just a normal self-contained HTML/CSS/JS page fragment.
3. Add one line to the `APPS` array at the top of `js/main.js`:
   ```js
   { id: 'your-app', name: 'Your App', icon: '✨', path: './apps/your-app/' }
   ```
That's it — no other file needs to change. (An entry can also carry
`args: [...]` — extra arguments for its `init()` whenever it's launched,
the way every game passes its own `.swf` to `apps/flash-player` — see
"Games".)

**Browser** (`apps/browser/`) is a normal popup app like any other —
`{ id, name, icon, path: './apps/browser/' }` — just one whose content is
an `<iframe>` with a small address bar in front of it, defaulting to
Wikipedia. Not a search engine: every mainstream one sends an
X-Frame-Options/CSP header specifically to refuse being shown inside
someone else's page, and there's no way around that from our side — it's
each site's own server-side policy, not a limitation of the iframe or
this code. This isn't assumed — Google, DuckDuckGo (both the main site
*and* its "lite" `html.duckduckgo.com`), Bing, Startpage, Brave Search,
Qwant, Mojeek, You.com and searx.be were all actually tried and confirmed
blocked; Yahoo looked embeddable (no blocking header) but rendered a
blank frame in practice, so it's excluded too. Wikipedia is the one
broadly-useful option that was actually verified to work, hence the
default — a plain search term goes to its search, not a general web
search. Navigating to a site that *does* block framing just shows that
browser's normal "refused to connect" page inside the frame — expected
behavior, not a bug. There's no back/forward, only Home/Reload — once the
iframe has navigated to a different (cross-origin) site, the page
genuinely can't read or drive its history from out here, so those
buttons would just be fake.

## Running it

Because everything is loaded with `fetch()`, this needs to be served over
a real `http(s)://` address, not opened directly as a `file://` path —
browsers block `fetch()`/`import()` of local files for security. Double-
clicking `index.html` will not work.

**GitHub Pages (no installs needed) — this is the target anyway:**

1. Create a new **public** repository on github.com (Pages' free tier requires public).
2. On the repo page: **Add file → Upload files**, then drag in everything
   *inside* the `Portfolio` folder (`index.html`, `README.md`, and the
   `css/`, `js/`, `widget/`, `apps/`, `themes/`, `games/` and `assets/` folders) —
   not the `Portfolio` folder itself, its contents, so `index.html` ends
   up at the repo root. Commit the changes. (Git can't track a truly
   empty folder, so if one of the `assets/` subfolders is still empty, it
   just won't appear on GitHub until it has a file in it — that's normal,
   nothing to fix.)
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
  added to `APPS` (in `js/main.js`) just gets appended to the first free
  slot instead of disturbing anyone's arrangement.
- A `ResizeObserver` recomputes the column count on resize (or mobile
  orientation change) and re-lays out every icon accordingly.
- Icon labels get a fixed dark `text-shadow` (in `widget/app-grid/index.css`)
  rather than relying on each theme's text color alone for contrast — since
  icons can sit anywhere on the desktop now, a label can land over any
  point of the wallpaper gradient/glow, light or dark, and a shadow halo
  stays readable regardless of what's behind it in a way a single fixed
  text color can't promise for every theme (current or future).

## Windows: dragging, resizing, minimize/maximize

- `widget/popup/index.js` makes each window's titlebar draggable with
  Pointer Events. While dragging it moves via a CSS `transform` (cheap
  for the browser — no layout/paint per pixel), and only "bakes" that
  into real `left`/`top` on release. That `makeDraggable()` is exported,
  and NotAVirus.exe's popups use it too (see "NotAVirus.exe"): a press on
  any button in the handle is that button's click, never a drag, only the
  primary button drags (a right-click opens the menu instead), and the
  caller says when dragging is off (`canDrag` — a maximized window). Dragging is clamped so a window can
  never end up partially off-screen or hidden behind the taskbar — the
  opening position is clamped the same way (matters most on a short/narrow
  mobile viewport). That clamp can't just measure the window's real
  width/height the way the drag/resize clamps do, though: a popup has no
  width of its own, only min/max-width bounds, and its real size depends
  on the app's content — which hasn't loaded into `.popup-body` yet at the
  point a window opens. So it mirrors the CSS `max-width: min(600px, 90vw)`
  formula in JS instead, to get the window's worst-case size without
  waiting on that; the real size, once content loads, is always that or
  smaller, so a window positioned/centered to fit its max-possible size
  can't end up overflowing (or noticeably off-center) once it settles.
  The height side mirrors `.popup-body`'s `max-height: 70vh` the same
  way — 70% of the whole *viewport* (`vh` includes the taskbar's strip),
  plus the 30px titlebar and the 2px borders. It once used 70% of the
  desktop layer and ignored the borders instead, ~40px short, so a window
  tall enough to hit that cap (Settings, any game) could open with its
  bottom edge and resize grip hidden behind the taskbar.
  Windows open centered by default — `openLeft`/`openTop` (the clamp's own
  bounds) already equal the leftover space around a worst-case-sized
  window, so half of each is dead center, no separate calculation needed —
  with `offset` (`js/main.js`'s `openCount`) still nudging each additional
  window diagonally from the last so a second window opened on top of a
  first isn't stacked exactly on top of it.
- `.popup-window` is a flex column (titlebar, then `.popup-body` as
  `flex: 1`) rather than plain stacked blocks — that's what lets the body
  actually fill whatever height the window ends up with, instead of
  staying content-sized and leaving a gap of `var(--win-bg)` below a
  short app when the window is bigger than its content (maximized, or
  manually resized — this was the "full screen looks weird" bug).
- **Resizing**: drag the bottom-right corner grip. Same approach as
  dragging — Pointer Events, `requestAnimationFrame`-batched — except it
  writes real `width`/`height` every frame instead of a transform,
  because a transform-scaled window would just be a blurry stretched
  snapshot; writing the real size makes the browser actually reflow the
  content at each size, which is what "scales smoothly" needs. Clamped to
  a sane minimum and to the visible desktop bounds, same rule dragging
  follows. `apps/media-viewer`'s image (`max-width:100%`,
  `object-fit:contain`) and `apps/file-explorer`'s grid (`auto-fill`
  columns) already reflow on their own as the window changes size —
  resizing didn't need those apps to change at all.
- Clicking anywhere on a window (or its taskbar tab) raises its z-index
  above every other window and fires a `popup:activated` event —
  `js/taskbar.js` listens for that to highlight the right tab (see
  "Taskbar tabs" below for how that module owns everything about a
  window's taskbar presence, not just this).
- **Maximize** (titlebar button, or double-click the titlebar) fills the
  desktop area — `#popup-layer`, i.e. up to the taskbar — via a CSS class
  (`.is-maximized`), *not* the browser's real Fullscreen API. That's on
  purpose: Fullscreen would take over the whole browser window and hide
  the taskbar with it, and the ask here was to stay "in the PC" — the
  taskbar has to stay reachable so you can still switch/restore windows.
  Dragging and resizing are both disabled while maximized (nothing to
  drag/resize when it already fills the screen); restoring puts back
  whatever position *and* size — including one from a manual resize — the
  window had before.
- **Minimize** (titlebar button) just hides the window (`.is-minimized`)
  and, once every window an app tab represents is minimized, dims that
  tab too. Clicking that tab again restores it; clicking the tab of the
  window that's already active minimizes it instead — the same toggle
  either way, `popup:toggle-minimize`, decided by `js/taskbar.js`'s tab
  click handler.
- **`pointer-events` lives on `.popup-window`, not on `#popup-layer`'s
  children generally.** loader.js's per-widget wrapper (`.widget-instance`)
  is sized to fill the *entire* desktop, even though the actual visible
  window (`.popup-window`) inside it, absolutely positioned, is usually
  much smaller — a real bug once had `#popup-layer > *` (i.e. that
  full-size wrapper) re-enabling `pointer-events` instead of the window
  itself, so with any window open, its invisible full-desktop wrapper sat
  on top of the whole icon grid and swallowed clicks on every icon
  *outside* that window's own borders too, not just inside them. Fixed by
  moving `pointer-events: auto` onto `.popup-window` itself
  (`widget/popup/index.css`) and leaving the wrapper (and `#popup-layer`)
  at `none` — worth remembering if a future full-size layer/wrapper ever
  needs the same treatment.

## Roadmap (not built yet, on purpose)

- **Mobile OS mode**: `css/main.css` already isolates all sizing into
  tokens and the shell is a single flex column, so a mobile layout can
  likely be a second stylesheet + a small breakpoint/JS check later,
  without touching any widget or app.
