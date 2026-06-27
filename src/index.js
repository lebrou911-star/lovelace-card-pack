// Entry point for lovelace-card-pack.
//
// Each card is imported for its side effects: it registers its own custom
// element via customElements.define() and pushes an entry onto
// window.customCards so it shows up in the Home Assistant card picker.
//
// To add a card to the pack, drop it under src/<card-name>/ and add a
// side-effect import below.

import "./expander-card/expander-card.js";
import "./minimalistic-area-card-plus/minimalistic-area-card-plus.js";
import "./popup-card/popup-card.js";

// __PACK_VERSION__ is replaced at build time (see build.mjs).
const VERSION = typeof __PACK_VERSION__ !== "undefined" ? __PACK_VERSION__ : "dev";

console.info(
  `%c LOVELACE-CARD-PACK %c v${VERSION} `,
  "color: white; background: #6d28d9; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #6d28d9; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
);
