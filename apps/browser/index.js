/* =====================================================================
   Browser, in a popup window rather than a real new tab. The one thing
   worth knowing: essentially every mainstream search engine — not just
   Google — sends an X-Frame-Options/CSP header specifically to refuse
   being shown inside someone else's iframe (Google, DuckDuckGo, Bing,
   Startpage, Brave Search, Qwant, Mojeek, You.com and searx.be all
   confirmed blocked, empirically, not assumed). It's each site's own
   choice, not something fixable from here. Wikipedia is the one broadly-
   useful, actually-verified-working exception, which is why it's the
   default/home page and what a plain search term routes to below — Yahoo
   also *looked* embeddable (no blocking header) but rendered a blank
   frame in practice, so it's excluded too; only sites checked to
   genuinely render something belong on this list.

   Navigating to a site that *does* block framing just shows that
   browser's normal "refused to connect" page inside the frame — expected
   iframe behavior, not a bug here.

   Also can't do real back/forward: once the iframe has navigated
   cross-origin, the page can't read or drive its history from out here —
   blocked by the browser on purpose. So there's no back/forward button,
   only Home/Reload/Go, all of which just work by setting our own address
   bar's iframe src.
   ===================================================================== */

const HOME_URL = 'https://en.wikipedia.org/';

export function init(container) {
  const frame = container.querySelector('.browser-frame');
  const addressEl = container.querySelector('.browser-address');
  const goBtn = container.querySelector('.browser-go');
  const reloadBtn = container.querySelector('.browser-reload');
  const homeBtn = container.querySelector('.browser-home');

  function navigate(input) {
    const url = resolveUrl(input);
    frame.src = url;
    addressEl.value = url;
  }

  goBtn.addEventListener('click', () => navigate(addressEl.value));
  addressEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') navigate(addressEl.value);
  });
  homeBtn.addEventListener('click', () => navigate(HOME_URL));
  reloadBtn.addEventListener('click', () => {
    // reassigning the identical src isn't guaranteed to actually reload in
    // every browser — bouncing through about:blank forces a real one
    const current = frame.src;
    frame.src = 'about:blank';
    requestAnimationFrame(() => { frame.src = current; });
  });

  navigate(HOME_URL);
}

/** A typed-in URL is used as-is; anything else is treated as a search term. */
function resolveUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return HOME_URL;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed; // already has a scheme
  if (!/\s/.test(trimmed) && /\.[a-z]{2,}$/i.test(trimmed)) return `https://${trimmed}`; // looks like "example.com"
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(trimmed)}&fulltext=1`;
}
