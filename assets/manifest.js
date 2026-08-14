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

   An entry can also be an *album* — `kind: 'album'` plus its own `items`
   list (same {id, name, file} shape, `file` still relative to the
   category folder) — the File Explorer shows it as a folder; opening it
   shows just those items. Only `images` uses this so far, but any
   category can.
   ===================================================================== */

export default {
  images: [
    {
      id: 'one-shot',
      name: 'One Shot',
      kind: 'album',
      items: [
        { id: 'cafe', name: 'Cafe.webp', file: 'One Shot/Cafe.webp' },
        { id: 'from-niko', name: 'From Niko.webp', file: 'One Shot/From Niko.webp' },
        { id: 'maize', name: 'Maize.webp', file: 'One Shot/Maize.webp' },
        { id: 'niko-and-robot', name: 'Niko and robot.webp', file: 'One Shot/Niko and robot.webp' },
        { id: 'niko-stars', name: 'Niko stars.webp', file: 'One Shot/Niko stars.webp' },
      ],
    },
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
