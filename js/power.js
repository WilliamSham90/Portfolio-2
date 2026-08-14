/* =====================================================================
   power.js
   Shutting down fades the whole desktop to black behind a pulsing green
   power button; clicking that plays a small fake terminal boot log, then
   fades back to the desktop. All of it lives in one full-screen overlay
   in index.html (#power-overlay), styled in css/main.css. Nothing here
   actually reloads or resets anything — it's purely a visual sequence,
   independent of js/context-menu.js's "Reset Desktop" (a real state wipe).
   ===================================================================== */

const BOOT_LINES = [
  'my-OS BIOS v1.0',
  'Checking memory............. OK',
  'Mounting filesystems........ OK',
  'Starting window manager..... OK',
  'Loading desktop..............',
  'Welcome.',
];

let overlay, onButton, log;

export function initPower() {
  overlay = document.getElementById('power-overlay');
  onButton = overlay.querySelector('.power-on-button');
  log = overlay.querySelector('.power-boot-log');

  onButton.addEventListener('click', bootUp);
}

/** Fades the screen to black with the "power on" button showing. */
export function shutDown() {
  log.hidden = true;
  log.textContent = '';
  onButton.hidden = false;
  overlay.hidden = false;
  // committed before the opacity transition starts, same two-step trick
  // as widget/app-grid's flip() — otherwise the browser can coalesce
  // "hidden removed" and "opacity animated in" into one frame and the
  // fade never actually plays
  void overlay.offsetWidth;
  overlay.classList.add('is-visible');
}

async function bootUp() {
  onButton.hidden = true;
  log.hidden = false;
  log.textContent = '';

  for (const line of BOOT_LINES) {
    await typeLine(line);
    await wait(120);
  }
  await wait(500);

  overlay.classList.remove('is-visible');
  await wait(400); // matches .power-overlay's CSS transition duration
  overlay.hidden = true;
}

function typeLine(text) {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      log.textContent += text[i];
      i += 1;
      if (i < text.length) {
        setTimeout(tick, 14);
      } else {
        log.textContent += '\n';
        resolve();
      }
    };
    tick();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
