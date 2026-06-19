# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.3] - 2024-06-18

### Fixed
- `expander-card`: the `breakout` (full-width children) feature broke inside
  popups/dialogs (more-info, Bubble Card pop-up, browser_mod…). With no
  `HUI-VIEW`/`HUI-SECTION` ancestor to measure, it fell back to the full
  browser viewport width, which on desktop pushed the child cards off-screen —
  the panel opened but appeared empty. It now falls back to the card's own
  width inside such containers, so the children stay visible. Also applies when
  `drop` is combined with `breakout`.

## [0.1.2] - 2024-06-18

### Fixed
- `minimalistic-area-card-plus`: the bottom action-icon row now follows the
  entity order from the config/editor. The upstream card rendered all
  "dialog" entities before all "toggle" entities, so reordering a toggle
  (light, switch…) ahead of a dialog had no visible effect. Sensors (top row)
  already followed config order.

## [0.1.1] - 2024-06-18

### Fixed
- Make the card registrations idempotent. If another resource (e.g. an old
  standalone Expander Card) already registered `expander-card`, the bundle now
  warns instead of throwing — so the other cards in the pack (notably
  `minimalistic-area-card-plus`) still register. `window.customCards` entries
  are also de-duplicated.

## [0.1.0] - 2024-06-18

Initial release. A single-bundle pack of custom Lovelace cards, installable in
one shot via HACS.

### Added
- **Build pipeline** — esbuild bundles every card under `src/` into a single
  IIFE file, `dist/lovelace-card-pack.js` (target `es2019`).
- **Expander Card** (`expander-card`) — header card that slides open to reveal
  child cards, with its built-in visual editor. (MIT)
- **Minimalistic Area Card Plus** (`minimalistic-area-card-plus`) — a
  dependency-free fork of junalmeida's Minimalistic Area Card, renamed to avoid
  clashing with a separate install of the original. Adds:
  - a full visual editor (ha-form / ha-entity-picker / ha-icon-picker / ha-selector),
  - an editable entities list (add / remove / reorder; per entity icon, name and
    tap action),
  - alignment controls for the bottom sensor row so text-valued states
    (e.g. `idle`) stay aligned with numeric ones.

[0.1.3]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.3
[0.1.2]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.2
[0.1.1]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.1
[0.1.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.0
