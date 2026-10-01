/* =====================================================================
   apps/music
   A small music player for assets/manifest.js's `music` list: the
   current song's cover as a picture-disc record that spins while it
   plays, the song list underneath, and the usual controls (shuffle,
   previous, play/pause, next, repeat, seek, volume).

   Plain <audio preload="none">: nothing downloads until play is pressed,
   then the browser streams it (range requests) — a 10 MB song starts
   after its first few hundred KB, not the whole file. Only one Music
   window plays at a time, and that one owns the Media Session: the
   keyboard's media keys, a phone's lock screen and the browser's own
   media controls all show its song and drive it.
   ===================================================================== */

import manifest from '../../assets/manifest.js';

const musicUrl = (file) => new URL(`../../assets/music/${file}`, import.meta.url).href;

const SONGS = manifest.music.map((song) => ({ ...song, src: musicUrl(song.file), coverUrl: musicUrl(song.cover) }));
const MEDIA_ACTIONS = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'];
const NEXT_REPEAT_MODE = { off: 'all', all: 'one', one: 'off' };

// module scope, so shared by every Music window: the <audio> currently
// allowed to make sound — starting another one pauses this one
let activeAudio = null;

/**
 * Called by loader.js after this app's HTML is mounted inside the popup.
 * @param {HTMLElement} container  this app's own root element
 * @param {{songId?: string}} [options]  open on (and play) this song —
 *   apps/file-explorer passes it when a song is clicked there
 */
export function init(container, { songId } = {}) {
  const app = container.querySelector('.music-app');
  const $ = (selector) => app.querySelector(selector);
  const audio = $('.music-audio');
  const seek = $('.music-seek');
  const volume = $('.music-volume-slider');
  const playBtn = $('.music-play');
  const shuffleBtn = $('.music-shuffle');
  const repeatBtn = $('.music-repeat');
  const muteBtn = $('.music-mute');
  const errorEl = $('.music-error');
  const win = container.closest('.popup-window');
  const outerRoot = win?.parentElement;

  if (SONGS.length === 0) {
    $('.music-title').textContent = 'No songs yet';
    $('.music-artist').textContent = 'Add one to assets/music and list it in assets/manifest.js.';
    return;
  }

  let index = 0; // SONGS index of the loaded song
  let order = SONGS.map((_, i) => i); // play order: as listed, or shuffled
  let seeking = false; // the seek bar is being dragged — don't fight it

  const rows = SONGS.map((song, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button type="button" class="music-track">
        <img class="music-track-art" alt="" loading="lazy" decoding="async" draggable="false">
        <span class="music-track-text">
          <span class="music-track-title"></span>
          <span class="music-track-artist"></span>
        </span>
        <span class="music-track-eq" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="music-track-time"></span>
      </button>`;
    const row = li.firstElementChild;
    row.querySelector('.music-track-art').src = song.coverUrl;
    row.querySelector('.music-track-title').textContent = song.title;
    row.querySelector('.music-track-artist').textContent = song.artist;
    row.querySelector('.music-track-time').textContent = formatTime(song.duration);
    row.addEventListener('click', () => load(i, true));
    $('.music-list').appendChild(li);
    return row;
  });

  function load(i, play = false) {
    index = i;
    const song = SONGS[i];
    audio.src = song.src; // pauses whatever was playing, without a 'pause' event
    setPlaying(false);
    $('.music-disc-art').src = song.coverUrl;
    app.style.setProperty('--cover', `url("${song.coverUrl}")`);
    $('.music-title').textContent = song.title;
    $('.music-artist').textContent = song.artist;
    errorEl.hidden = true;
    rows.forEach((row, n) => row.setAttribute('aria-current', String(n === i)));
    showTime(0);
    if (activeAudio === audio) claimMediaSession();
    if (play) audio.play().catch(() => {}); // blocked or interrupted: it just stays paused
  }

  function setPlaying(playing) {
    app.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function next(play = !audio.paused) {
    load(order[(order.indexOf(index) + 1) % order.length], play);
  }

  function previous() {
    if (audio.currentTime > 3) { // like any player: restart the song first
      audio.currentTime = 0;
      return;
    }
    load(order[(order.indexOf(index) - 1 + order.length) % order.length], !audio.paused);
  }

  function duration() {
    return Number.isFinite(audio.duration) ? audio.duration : SONGS[index].duration;
  }

  function showTime(time) {
    const total = duration();
    seek.max = String(total);
    seek.value = String(time);
    seek.style.setProperty('--fill', `${total ? (time / total) * 100 : 0}%`);
    seek.setAttribute('aria-valuetext', `${formatTime(time)} of ${formatTime(total)}`);
    $('.music-time-current').textContent = formatTime(time);
    $('.music-time-total').textContent = formatTime(total);
  }

  function claimMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const song = SONGS[index];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork: [{ src: song.coverUrl }],
    });
    setMediaHandlers({
      play: () => audio.play().catch(() => {}),
      pause: () => audio.pause(),
      previoustrack: previous,
      nexttrack: () => next(),
      seekto: (details) => { audio.currentTime = details.seekTime; },
    });
  }

  /* ---------- controls ---------- */

  playBtn.addEventListener('click', () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (audio.error) audio.load(); // a song that failed to load gets a fresh try
    audio.play().catch(() => {});
  });
  $('.music-next').addEventListener('click', () => next());
  $('.music-prev').addEventListener('click', previous);

  shuffleBtn.addEventListener('click', () => {
    const on = shuffleBtn.getAttribute('aria-pressed') !== 'true';
    shuffleBtn.setAttribute('aria-pressed', String(on));
    // the current song stays where it is; shuffling decides what follows it
    order = on
      ? [index, ...shuffled(SONGS.map((_, i) => i).filter((i) => i !== index))]
      : SONGS.map((_, i) => i);
  });

  repeatBtn.addEventListener('click', () => {
    const mode = NEXT_REPEAT_MODE[repeatBtn.dataset.mode];
    repeatBtn.dataset.mode = mode;
    repeatBtn.setAttribute('aria-pressed', String(mode !== 'off'));
    repeatBtn.setAttribute('aria-label', `Repeat: ${mode}`);
    audio.loop = mode === 'one'; // the browser loops the song itself; 'ended' never fires
  });

  // dragging the seek bar previews the time; the jump happens on release
  seek.addEventListener('input', () => {
    seeking = true;
    showTime(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    audio.currentTime = Number(seek.value);
    seeking = false;
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    audio.muted = audio.volume === 0;
  });
  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (!audio.muted && audio.volume === 0) audio.volume = 0.5; // it was slid to zero — give some back
  });

  /* ---------- the <audio> element reporting back ---------- */

  audio.addEventListener('play', () => {
    if (activeAudio && activeAudio !== audio) activeAudio.pause(); // one window plays at a time
    activeAudio = audio;
    claimMediaSession();
    setPlaying(true);
  });
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('playing', () => { errorEl.hidden = true; });
  audio.addEventListener('timeupdate', () => {
    if (!seeking) showTime(audio.currentTime);
  });
  audio.addEventListener('durationchange', () => showTime(audio.currentTime));
  audio.addEventListener('ended', () => {
    const atLastSong = order.indexOf(index) === order.length - 1;
    if (atLastSong && repeatBtn.dataset.mode === 'off') load(order[0]); // end of the list: back to the top, stopped
    else next(true);
  });
  audio.addEventListener('volumechange', () => {
    const silent = audio.muted || audio.volume === 0;
    app.classList.toggle('is-muted', silent);
    muteBtn.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
    volume.value = String(silent ? 0 : audio.volume);
    volume.style.setProperty('--fill', `${Number(volume.value) * 100}%`);
  });
  volume.style.setProperty('--fill', '100%');
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return; // emptied on purpose, when the window closed
    errorEl.textContent = `Couldn’t load “${SONGS[index].title}”. Check your connection, then press play to try again.`;
    errorEl.hidden = false;
    setPlaying(false);
  });

  /* ---------- the rest of the OS ---------- */

  // a song clicked in My Computer plays here instead of opening a second
  // player — in the window that's playing (or last played), else the
  // first Music window to hear about it
  const listeners = new AbortController();
  document.addEventListener('os:play-song', (event) => {
    if (event.defaultPrevented || (activeAudio && activeAudio !== audio)) return;
    event.preventDefault();
    load(Math.max(0, SONGS.findIndex((s) => s.id === event.detail.id)), true);
    outerRoot?.dispatchEvent(new CustomEvent(win.classList.contains('is-minimized') ? 'popup:toggle-minimize' : 'popup:focus'));
  }, { signal: listeners.signal });

  // closing the window stops the music and hands back the media keys —
  // otherwise a closed player could still answer them
  outerRoot?.addEventListener('popup:closed', () => {
    listeners.abort();
    audio.pause();
    audio.removeAttribute('src');
    audio.load(); // drops any download still in flight
    if (activeAudio === audio) {
      activeAudio = null;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        setMediaHandlers(null);
      }
    }
  }, { once: true });

  const start = SONGS.findIndex((s) => s.id === songId);
  load(Math.max(0, start), start >= 0); // opened from a song: play it; from the desktop: wait for play
}

function setMediaHandlers(handlers) {
  for (const action of MEDIA_ACTIONS) {
    try {
      navigator.mediaSession.setActionHandler(action, handlers?.[action] ?? null);
    } catch {
      // this browser doesn't support that action — nothing to wire up
    }
  }
}

function formatTime(seconds) {
  const s = Math.floor(seconds || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Fisher–Yates: every order equally likely (unlike sort(() => Math.random() - 0.5)). */
function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
