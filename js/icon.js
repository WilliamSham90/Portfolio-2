/* =====================================================================
   icon.js
   Icons throughout this OS are either a literal emoji glyph (a plain
   string, rendered as text) or a path to one of the real icon images
   under assets/system/Icons — this one function is how every render site
   (widget/app-grid, the taskbar, apps/file-explorer) tells which, so
   none of them need their own regex or an extra "isImage" flag threaded
   through the data.
   ===================================================================== */

/** True if `icon` looks like an image path/URL rather than an emoji glyph. */
export function isImageIcon(icon) {
  return typeof icon === 'string' && /\.(png|jpe?g|svg|webp|gif)(\?.*)?$/i.test(icon);
}
