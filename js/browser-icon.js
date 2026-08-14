/* =====================================================================
   browser-icon.js
   Picks an icon/name for the "Browser" desktop app based on whatever
   browser it's actually running in. This OS doesn't ship any image
   assets for app icons — every icon so far is a single emoji glyph — so
   rather than a generic globe for everyone, each detected browser gets
   the closest emoji match to its own real logo/mascot (Firefox's fox,
   Safari's compass, ...) instead of an actual (trademarked) logo image.

   User-agent sniffing is fragile in general (spoofable, and every
   Chromium-based browser's UA also contains "Chrome/") — fine here since
   the only thing riding on it is which emoji shows up, not any real
   functionality. Order matters: the more specific checks have to run
   before the generic Chrome/Safari ones they'd otherwise also match.
   ===================================================================== */

export function detectBrowser() {
  const ua = navigator.userAgent;

  if (/Firefox\//.test(ua)) return { icon: '🦊', name: 'Firefox' };
  if (/Edg\//.test(ua)) return { icon: '🌊', name: 'Edge' };
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return { icon: '🅾️', name: 'Opera' };
  if (/Chrome\/|Chromium\//.test(ua)) return { icon: '🌐', name: 'Chrome' };
  if (/Safari\//.test(ua)) return { icon: '🧭', name: 'Safari' };

  return { icon: '🌐', name: 'Browser' };
}
