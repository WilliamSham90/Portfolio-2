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

   Any entry can also name a `cover` (an image in the same folder), which
   the File Explorer shows as that file's icon. `music` entries carry the
   Music app's data too — a clean `title` and `artist` (the files' own
   tags can't be trusted) and the `duration` in seconds, so the playlist
   can show lengths without downloading every song to find out.
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
    { id: 'all-my-love', name: 'All My Love.mp3', file: 'all-my-love-noah-kahan.mp3', cover: 'all-my-love-cover.jpg', title: 'All My Love', artist: 'Noah Kahan', duration: 252 },
    { id: 'chowder', name: 'Chowder Theme Song.mp3', file: 'chowder-theme-song.mp3', cover: 'chowder-cover.jpg', title: 'Chowder Theme Song', artist: 'Cartoon Network', duration: 29 },
    { id: 'dandelions', name: 'Dandelions.mp3', file: 'dandelions-ruth-b.mp3', cover: 'dandelions-cover.jpg', title: 'Dandelions', artist: 'Ruth B.', duration: 229 },
    { id: 'orbiter', name: 'Orbiter.mp3', file: 'orbiter-noah-kahan.mp3', cover: 'orbiter-cover.jpg', title: 'Orbiter', artist: 'Noah Kahan', duration: 287 },
    { id: 'shes-always-a-woman', name: 'She’s Always a Woman.mp3', file: 'shes-always-a-woman-billy-joel.mp3', cover: 'shes-always-a-woman-cover.jpg', title: 'She’s Always a Woman', artist: 'Billy Joel', duration: 203 },
    { id: 'someone-new', name: 'Someone New.mp3', file: 'someone-new-hozier.mp3', cover: 'someone-new-cover.jpg', title: 'Someone New', artist: 'Hozier', duration: 222 },
    { id: 'the-bitch-is-back', name: 'The Bitch Is Back.mp3', file: 'the-bitch-is-back-elton-john.mp3', cover: 'the-bitch-is-back-cover.jpg', title: 'The Bitch Is Back', artist: 'Elton John', duration: 225 },
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
