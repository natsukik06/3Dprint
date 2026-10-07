// Zen Kaku Gothic New / Zen Old Mincho used to be loaded here through next/font/google. For a Japanese
// font Google splits the file into ~120 slices per weight (485 @font-face rules), and every page that
// showed Japanese text downloaded around a hundred of them -- about 7MB of fonts on the home page, the
// biggest reason the site felt slow. They are replaced by the phone/PC's own Japanese fonts (the CSS
// variables below, set in globals.css), so nothing is downloaded. The exports keep their old shape so
// the pages that use them did not need to change.
export const zenMincho = { variable: "" };
export const zenGothic = { variable: "" };

export const displayFont = { fontFamily: "var(--font-zen-mincho), serif" };
