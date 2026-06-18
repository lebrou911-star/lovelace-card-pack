# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.0
