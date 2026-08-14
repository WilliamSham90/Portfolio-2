# my-os — architecture notes

## How it fits together

```
Portfolio/
├── index.html              OS shell only: wallpaper canvas + bottom taskbar — the
│                            only HTML file, and only file left loose at the root
├── README.md
│
├── css/
│   └── main.css              layout/size tokens + DEFAULT color/font tokens
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
│   ├── start-menu.js             the taskbar's Start button + its dropdown (see "Start menu")
│   ├── power.js                  the shut-down/boot-up overlay (see "Start menu")
│   └── clock-panel.js             taskbar clock + its slide-in date/calendar panel (see "Taskbar clock")
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
    ├── browser/                  iframe + address bar (see "Adding a new app later")
    │   ├── index.html
    │   ├── index.css
    │   └── index.js
    └── system-info/               Start Menu only, not on the desktop — not in APPS (see "System Info")
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
   `init()` with the container

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
4. `widget/popup/index.js` sets its own title/close button, then calls
   `loadWidget()` again — this time on the app's own folder — to fetch
   that app's `index.html`/`index.css`/`index.js` into the window's body.

## Theming

This is the "Theme" half of the **Settings** app (`apps/themes/` — the
folder wasn't renamed, only the app's `name`/`id` in `APPS`, since it's
still fundamentally the same theme-picking code, just with an "Icon
Style" section added alongside it now — see "Icons"). Every color/font a
widget or app uses is a CSS custom property declared in
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

To add a 7th theme's font (or swap one of these): drop the `.ttf` (or
`.woff2`) files anywhere under `assets/fonts/`, add matching `@font-face`
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
  `computer-storage.png`, `earth.png` (**Browser**, fixed — no more
  per-browser-detected icon). **Hello There** still uses `add.png` as a
  placeholder until it has a real one of its own.
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

- A folder is virtual — `{id, name, appIds}` — since this is a static
  site with no backend to create a real one on disk. `js/folders.js`
  (same shared-kernel pattern as `js/theme.js`) is the only thing that
  reads/writes them, via `localStorage`. Any change fires
  `os:folders-changed` on `document`, so the desktop and every open File
  Explorer window can re-render themselves. What icon a folder is drawn
  with isn't stored on the folder at all — it comes from `js/icon-style.js`
  (see "Icons" above), so switching icon style re-skins every folder at
  once instead of needing to touch this data.
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
  Clicking a PDF/audio/video file opens it in a new tab and lets the
  browser's own viewer handle it — no custom player yet. **Images** are
  the one category with real handling: each row/cell shows the actual
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
  purpose) and the custom-skinned music/video players — those need their
  own focused design pass rather than being rushed in here.

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
customization — theme, folders, icon positions — back to first-boot
defaults and reloads the page. Each piece of state stays owned by its own
module (`js/theme.js`, `js/folders.js`, `widget/app-grid`); Reset doesn't
reach into any of them directly, it just dispatches `os:reset` on
`document` and each one clears its own `localStorage` key in response —
same loose-coupling pattern as everything else here, and it means a
future module with its own persisted state only has to add its own
listener, no changes needed anywhere else.

**Shift+right-click still opens the real browser menu** — the handler
checks `event.shiftKey` and simply doesn't call `preventDefault()` when
it's held, so the native menu (Inspect, etc.) opens exactly as normal.
That's the only thing touched; keyboard devtools shortcuts (F12,
Ctrl+Shift+I) were never intercepted in the first place.

## Start menu

`js/start-menu.js` is the taskbar's left-side Start button (`home.png`,
transparent until hovered/active — a `.taskbar-divider` beside it in
`index.html` is what actually marks the split from the open-window tabs,
now that the button has no resting-state border/background of its own to
imply it) and its dropdown. It's initialized as `initStartMenu(START_MENU_APPS)` from
`js/main.js`'s `boot()` — receiving the app list as a parameter rather than
importing it back from `main.js` itself, since `main.js` already imports
`start-menu.js`; importing it the other way round would be a circular
import, and depending on evaluation order could hit that list before its
`const` is initialized. `START_MENU_APPS` (`js/main.js`) is a specific,
curated, *ordered* subset — **My Computer, Browser, Settings, System
Info** — not `APPS` itself: no Hello There (a placeholder/demo app, not
meant to look "installed"), plus **System Info**, which isn't a desktop
icon at all and exists only as this one entry. Since it's not in `APPS`
(which also drives the desktop grid), `js/main.js` keeps a second list,
`ALL_APPS` (`[...APPS, SYSTEM_INFO_APP]`), for `os:launch-app` to resolve
an id against — otherwise clicking System Info in the menu would fire the
same event every other app click does, and `main.js` wouldn't be able to
find it. The dropdown lists each app (same icon-or-emoji rendering as
everywhere else, via `js/icon.js`) — clicking one fires `os:launch-app`,
same event a desktop icon click fires — plus a Power off button at the
bottom. It closes on outside-click, Escape, or launching an app.

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
both instead of one hiding the other; the holiday's name is a native
`title` tooltip — there's no room in a cell this small for real text.
William's birthday (17 January, `BIRTHDAY` in `js/clock-panel.js`) gets
the same "different color, no room for real text so it's a tooltip"
treatment, but as a *filled* circle (`.is-birthday`, `--lilac`) rather
than a ring, so it doesn't read as just another holiday — the one edge
case where it could land on the same day as `.is-today` is resolved by
CSS declaration order (`.is-today` declared last wins the tie), not
JS, since "today" is the more useful thing to see at a glance.

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

## Adding a new app later

1. Duplicate `apps/hello-world/` → `apps/your-app/`.
2. Build it — it's just a normal self-contained HTML/CSS/JS page fragment.
3. Add one line to the `APPS` array at the top of `js/main.js`:
   ```js
   { id: 'your-app', name: 'Your App', icon: '✨', path: './apps/your-app/' }
   ```
That's it — no other file needs to change.

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

Its icon/name come from `js/browser-icon.js`, which sniffs
`navigator.userAgent` at boot and picks the closest emoji to whatever
browser is actually running it (Firefox's fox, Safari's compass, ...)
rather than a generic globe for everyone — cosmetic only, nothing else
depends on the detection being exact.

## Running it

Because everything is loaded with `fetch()`, this needs to be served over
a real `http(s)://` address, not opened directly as a `file://` path —
browsers block `fetch()`/`import()` of local files for security. Double-
clicking `index.html` will not work.

**GitHub Pages (no installs needed) — this is the target anyway:**

1. Create a new **public** repository on github.com (Pages' free tier requires public).
2. On the repo page: **Add file → Upload files**, then drag in everything
   *inside* the `Portfolio` folder (`index.html`, `README.md`, and the
   `css/`, `js/`, `widget/`, `apps/`, `themes/` and `assets/` folders) —
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

## Windows: dragging, resizing, minimize/maximize + taskbar tabs

- `widget/popup/index.js` makes each window's titlebar draggable with
  Pointer Events. While dragging it moves via a CSS `transform` (cheap
  for the browser — no layout/paint per pixel), and only "bakes" that
  into real `left`/`top` on release. Dragging is clamped so a window can
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
  above every other window and fires a `popup:activated` event.
- `js/main.js` listens for that event and keeps one `.taskbar-tab` button
  in `#taskbar-tabs` per open window, highlighting whichever one is
  active and removing the tab automatically when that window is closed.
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
  and dims its taskbar tab. Clicking that tab again restores it; clicking
  the tab of the window that's already active minimizes it instead — the
  same toggle either way, `popup:toggle-minimize`, decided by
  `js/main.js`'s tab click handler based on the tab's current classes.
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
