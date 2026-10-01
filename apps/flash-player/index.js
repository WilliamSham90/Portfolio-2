/* =====================================================================
   apps/flash-player
   Plays one Flash game (.swf) in its window through Ruffle
   (https://ruffle.rs) — a Flash Player emulator in WebAssembly, no
   plugin needed. Every entry in js/main.js's GAMES opens this same app
   with its own { swf, width, height } (see `args` on openApp()).

   Ruffle is ~5 MB (JS + WebAssembly), so it's only fetched the first
   time a game is opened — never at boot — then shared by every game
   window after that. Pinned to an exact version with an integrity hash
   rather than the CDN's floating "latest" URL, which can change under
   the site without warning; jsDelivr serves it brotli-compressed with
   year-long caching, so a repeat visit doesn't download it again.
   ===================================================================== */

const RUFFLE_URL = 'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.6.0/ruffle.js';
const RUFFLE_INTEGRITY = 'sha384-eYV2CNXhSXdisg3+UbVhJIIRzygKoAWlfmBTkftwI9bsN5ctHUovLhbLzCcTelXF';

let ruffleReady = null; // module scope, so shared by every game window

function loadRuffle() {
  ruffleReady ??= new Promise((resolve, reject) => {
    // read by Ruffle as it installs: polyfills off, or it watches the whole
    // page (a MutationObserver on every DOM change) for <object>/<embed>
    // Flash content to replace — there's none, players are made below
    window.RufflePlayer ??= {};
    window.RufflePlayer.config = { ...window.RufflePlayer.config, polyfills: false };

    const script = document.createElement('script');
    script.src = RUFFLE_URL;
    script.integrity = RUFFLE_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => resolve(window.RufflePlayer.newest()));
    script.addEventListener('error', () => {
      script.remove();
      ruffleReady = null; // offline, say — let the next game window try again
      reject(new Error(`Could not load ${RUFFLE_URL}`));
    });
    document.head.appendChild(script);
  });
  return ruffleReady;
}

/**
 * Called by loader.js after this app's HTML is mounted inside the popup.
 * Deliberately doesn't wait for the game to load: js/main.js only wires up
 * the window's close button and taskbar tab once init() has returned, so
 * awaiting Ruffle's download here would leave both dead until it finished.
 * @param {HTMLElement} container  this app's own root element
 * @param {{swf: string, width: number, height: number}} game  the SWF + its stage size
 */
export function init(container, game) {
  const stage = container.querySelector('.flash-player');
  stage.style.setProperty('--ar', String(game.width / game.height));

  // minimizing only hides a window (widget/popup), it'd keep playing — so
  // pause the game while it's out of sight (no sound, no CPU), and pick it
  // back up on restore unless it was already paused (from Ruffle's own menu)
  let api = null;
  let minimized = false;
  let resumeOnRestore = false;
  container.closest('.popup-window')?.parentElement.addEventListener('popup:minimized', (event) => {
    minimized = event.detail.minimized;
    if (!api) return; // still loading — handled once it's ready, below
    if (minimized) {
      resumeOnRestore = !api.suspended;
      api.suspend();
    } else if (resumeOnRestore) {
      api.resume();
    }
  });

  loadRuffle()
    .then(async (ruffle) => {
      if (!container.isConnected) return; // window was closed while Ruffle downloaded
      const player = ruffle.createPlayer();
      player.classList.add('flash-player-ruffle');
      stage.appendChild(player);
      // closing the window needs nothing extra: removing the player from the
      // page is what tears Ruffle down (its disconnectedCallback), sound and all
      const playerApi = player.ruffle();
      await playerApi.load({
        url: game.swf,
        autoplay: 'on', // the click that opened this window is the gesture browsers want before sound
        letterbox: 'on', // black bars, never stretching or off-stage art, when the window's shape differs
        openUrlMode: 'deny', // a game's own sponsor/"more games" links can't navigate the OS page away
      });
      api = playerApi;
      if (minimized) {
        resumeOnRestore = true;
        api.suspend();
      }
    })
    .catch(() => {
      // a bad .swf is Ruffle's to report (it shows its own error screen over
      // this); this message is only ever visible when Ruffle itself didn't load
      stage.querySelector('.flash-player-status').textContent =
        'Couldn’t load the Flash player — check your connection, then reopen the game.';
    });
}
