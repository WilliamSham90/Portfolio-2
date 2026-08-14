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
  }

  render();
}
