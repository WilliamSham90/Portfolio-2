/* =====================================================================
   assets/manifest.js
   The File Explorer app's registry of what's in /assets. A static site
   has no way to ask the server "what files are in this folder" (no
   backend, and GitHub Pages doesn't do directory listings) — so, same
   as APPS in main.js, files are listed here by hand instead of being
   discovered automatically.

   To add a file: drop it in the matching assets/<category>/ folder,
   then add one line below. `file` is the filename inside that folder
   (subfolders are fine, e.g. 'trip/beach.jpg').
   ===================================================================== */

export default {
  images: [
    // { id: 'sunset', name: 'sunset.jpg', file: 'sunset.jpg' },
  ],
  music: [
    // { id: 'neptune-mood', name: 'neptune mood.mp3', file: 'neptune-mood.mp3' },
  ],
  videos: [
    // { id: 'clip', name: 'clip.mp4', file: 'clip.mp4' },
  ],
  pdf: [
    // { id: 'resume', name: 'resume.pdf', file: 'resume.pdf' },
  ],
  // fonts just list the family name (see themes/fonts.css for the actual
  // files) — there's no one file to open, so no `file` needed here
  fonts: [
    { id: 'quicksand', name: 'Quicksand' },
    { id: 'space-mono', name: 'Space Mono' },
    { id: 'cinzel', name: 'Cinzel' },
    { id: 'architects-daughter', name: 'Architects Daughter' },
    { id: 'space-grotesk', name: 'Space Grotesk' },
    { id: 'orbitron', name: 'Orbitron' },
  ],
};
