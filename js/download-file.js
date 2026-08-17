/* =====================================================================
   download-file.js
   Downloads a Blob to the visitor's own computer as a real file — a
   temporary <a download> click, the universally-supported way to do
   this (apps/notepad, apps/paint). The newer File System Access API's
   showSaveFilePicker() would give a real "Save As" dialog (and let a
   second save overwrite the same file without re-prompting), but
   neither Firefox nor Safari implement it at all, and a portfolio site
   can't assume every visitor is on Chromium.

   There's no callback confirming a download actually finished (or that
   an OS save dialog inside it wasn't cancelled) — callers just treat it
   as saved the moment it's triggered, same as any other download button.
   ===================================================================== */

export function downloadFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click(); // no need to attach it to the DOM first — click() works either way
  // a tick's delay rather than revoking immediately after click() — belt
  // and suspenders against a browser that's still reading the blob URL
  // right when it'd otherwise get pulled out from under it
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
