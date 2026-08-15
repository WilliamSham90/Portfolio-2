// Source palette: "nostalgOS 12" by Yeoldegoat (lospec.com/palette-list/nostalgos-12)
export default {
  id: 'dial-up-dream',
  name: 'Dial-Up Dream',
  fonts: {
    display: {
      family: 'Quicksand',
      fallback: "'Trebuchet MS', Arial, sans-serif",
      files: [
        { weight: 400, style: 'normal' },
        { weight: 700, style: 'normal' },
      ],
    },
  },
  colors: {
    pearl: '#dad4c9',
    rose: '#ffd183',
    // was #eeb24a — a pale butter-yellow that only ever worked as a glow
    // color over the dark desktop background; as *text* (accent labels,
    // borders) over this theme's own light winBg (#deada5), the two sat
    // at ~1.1:1 contrast, functionally invisible. This amber reads as
    // ~5:1 against winBg (WCAG AA needs 4.5:1) and still glows warm
    // against dark surfaces — arguably more "amber CRT monitor" for a
    // theme called Dial-Up Dream anyway.
    hotrose: '#6b3208',
    aqua: '#5a8bde',
    lilac: '#b89ce9',

    text: '#dad4c9',
    textSoft: '#deada5',
    textMuted: '#b89ce9',
    textDark: '#272a32',

    paper: '#dad4c9',
    paperText: '#272a32',

    border: '#deada5',
    borderBright: '#dad4c9',

    btnBg: '#dad4c9',
    btnBg2: '#ffd183',
    btnBg3: '#5a8bde',
    btnText: '#272a32',

    winBg: '#deada5',
    winTitle: '#dc6250',
    winText: '#272a32',

    wrapA: '#272a32',
    wrapB: '#21525a',
    wrapC: '#272a32',
  },
};
