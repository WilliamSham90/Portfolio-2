/* =====================================================================
   loader.js
   The one small piece of shared "kernel" machinery. Every widget and
   every app is just a folder containing index.html + index.css +
   index.js, so one function knows how to load any of them:

     1. fetch the folder's index.html and inject it into a container
     2. link the folder's index.css (once per folder, even if the
        folder is loaded more than once — e.g. two popups)
     3. import() the folder's index.js as an ES module and, if it
        exports an init(container, ...args) function, call it

   No iframes, no framework. Each index.js's top-level scope is
   isolated automatically because ES modules are file-scoped, and each
   index.css should wrap its rules in @scope(...) so its styles can
   never leak out into another widget or app.

   `basePath` is always resolved relative to the *page* (document.baseURI),
   not to this file's own location — deliberately, since fetch() and
   dynamic import() disagree on that by default (fetch resolves a relative
   URL against the page, import() against the importing module), which
   would otherwise make basePath mean two different things in the same
   function. Resolving both explicitly against the page means every
   basePath everywhere (main.js's APPS, the two loadWidget() calls in
   main.js itself, app.path in widget/popup) can just be written relative
   to the site root, and none of it breaks if loader.js itself ever moves.
   ===================================================================== */

// base.href -> Promise that resolves once that folder's index.css has
// actually loaded (not just been requested) — see loadWidget() for why
// this needs to be awaited, not fire-and-forget.
const styleReady = new Map();

/**
 * @param {string} basePath   folder path relative to the site root, e.g. "./widget/popup/"
 * @param {HTMLElement} mountPoint  element to render into
 * @param {object} [options]
 * @param {boolean} [options.multiple]  append instead of replacing (for
 *                                      widgets you may want more than one
 *                                      instance of, like popup windows)
 * @param {any[]} [options.initArgs]    extra args passed to the module's init()
 * @returns {Promise<{module: any, root: HTMLElement}>}
 */
export async function loadWidget(basePath, mountPoint, options = {}) {
  const { multiple = false, initArgs = [] } = options;
  const base = new URL(basePath, document.baseURI);

  if (!styleReady.has(base.href)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('index.css', base).href;
    styleReady.set(base.href, new Promise((resolve) => {
      // resolve on error too — a missing/broken stylesheet shouldn't hang
      // every future load of this folder forever
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
    }));
    document.head.appendChild(link);
  }

  const htmlUrl = new URL('index.html', base);
  // fetched in parallel with the stylesheet load rather than after it —
  // no extra latency, just makes sure BOTH are actually done (not merely
  // requested) before anything below reads this widget's layout. Without
  // this, the very first time a folder's CSS loads, a piece of index.js
  // that measures its own size right in init() (a popup window centering/
  // clamping itself, say) can run before that CSS has applied, and get a
  // wrong, unstyled measurement.
  const [html] = await Promise.all([
    fetch(htmlUrl).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${htmlUrl} (${res.status})`);
      return res.text();
    }),
    styleReady.get(base.href),
  ]);

  const root = document.createElement('div');
  root.className = 'widget-instance';
  root.innerHTML = html;

  if (multiple) {
    mountPoint.appendChild(root);
  } else {
    mountPoint.replaceChildren(root);
  }

  const mod = await import(new URL('index.js', base).href);
  if (typeof mod.init === 'function') {
    await mod.init(root, ...initArgs);
  }

  return { module: mod, root };
}
