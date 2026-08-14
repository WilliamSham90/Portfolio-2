/**
 * Called by loader.js after this app's HTML is mounted inside the popup.
 * Everything here is static content — the only thing that needs JS at all
 * is resolving the two asset images, since a plain relative src written
 * in index.html would resolve against the *page's* URL once injected, not
 * this folder's (see README.md > "Icons") — same reason every other
 * icon in this OS is resolved via import.meta.url in a .js file instead
 * of hard-coded in markup.
 * @param {HTMLElement} container  this app's own root element
 */
export function init(container) {
  container.querySelector('.sysinfo-avatar').src =
    new URL('../../assets/system/Icons/basic/williampp.jpg', import.meta.url).href;
  container.querySelector('.sysinfo-heart').src =
    new URL('../../assets/system/Icons/basic/two-hearts.png', import.meta.url).href;
}
