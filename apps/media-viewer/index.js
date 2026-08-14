/**
 * Called by loader.js after this app's HTML is mounted.
 * @param {HTMLElement} container  this app instance's own root element
 * @param {{images: Array<{name:string,url:string}>, index?: number}} payload
 *   `images` is the full sibling list (an album, or a category's flat
 *   file list) so prev/next can step through it; `url` is a real,
 *   already-resolved URL — this app doesn't know or care where an image
 *   actually lives (assets/, an album subfolder, wherever).
 */
export function init(container, payload) {
  const { images, index = 0 } = payload;
  let current = Math.min(Math.max(index, 0), images.length - 1);

  const imageEl = container.querySelector('.media-viewer-image');
  const captionEl = container.querySelector('.media-viewer-caption');
  const prevBtn = container.querySelector('.media-viewer-prev');
  const nextBtn = container.querySelector('.media-viewer-next');
  // the window title is set once, at open, by widget/popup — from
  // whichever image was actually clicked. Reaching up to it here so it
  // stays in sync as prev/next moves to a different image; there isn't a
  // generic "app wants to rename its own window" event for this since
  // nothing else has needed one yet
  const titleEl = container.closest('.popup-window')?.querySelector('.popup-title');

  prevBtn.hidden = images.length <= 1;
  nextBtn.hidden = images.length <= 1;
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));

  function go(delta) {
    current = (current + delta + images.length) % images.length;
    render();
  }

  function render() {
    const image = images[current];
    imageEl.src = image.url;
    imageEl.alt = image.name;
    captionEl.textContent = images.length > 1
      ? `${image.name} (${current + 1}/${images.length})`
      : image.name;
    if (titleEl) titleEl.textContent = image.name;
  }

  render();
}
