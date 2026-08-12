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
   ===================================================================== */

const loadedStyles = new Set();

/**
 * @param {string} basePath   folder path ending in "/", e.g. "./widget/popup/"
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

  if (!loadedStyles.has(basePath)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = basePath + 'index.css';
    document.head.appendChild(link);
    loadedStyles.add(basePath);
  }

  const html = await fetch(basePath + 'index.html').then((res) => {
    if (!res.ok) throw new Error(`Could not load ${basePath}index.html (${res.status})`);
    return res.text();
  });

  const root = document.createElement('div');
  root.className = 'widget-instance';
  root.innerHTML = html;

  if (multiple) {
    mountPoint.appendChild(root);
  } else {
    mountPoint.replaceChildren(root);
  }

  const mod = await import(basePath + 'index.js');
  if (typeof mod.init === 'function') {
    await mod.init(root, ...initArgs);
  }

  return { module: mod, root };
}
