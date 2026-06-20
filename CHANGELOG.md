# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.4] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus` editor: the per-entity text fields (Name, Icon
  template, Icon colour, Icon size, Badge icon template, Badge colour) were
  effectively invisible when empty — a filled `ha-textfield` has no visible
  outline on a dark theme, so the new "Icon (template)" field could not be
  found. They are now `outlined`, showing a clear border (and label) even when
  empty.

## [0.2.3] - 2026-06-20

### Added
- `minimalistic-area-card-plus` editor: each entity now has an "Icon (template)"
  and "Badge icon (template)" text field beside the icon pickers, so a Jinja
  template for the icon can be entered straight from the visual editor (the
  picker stays for static icons). Both widgets share the same `icon` /
  `badge_icon` key — whichever is filled wins, and the editor routes a template
  value to the template field and a static `mdi:` value to the picker.

## [0.2.2] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus` editor: section titles ("Entities", "Sensor row
  alignment") and their hint text overlapped, and the per-entity "Colour, size &
  badge" hint rode up over the icon field. Caused by negative CSS margins
  (`section-title` margin-bottom and `hint` margin-top); replaced with normal
  spacing so the labels no longer collide.

## [0.2.1] - 2026-06-20

### Fixed
- Release pipeline: the `release.yml` workflow now pins the tag to the pushed
  commit (`target_commitish`) and marks it `make_latest`. The repository's
  default branch is not `main`, so the Releases API had tagged the previous
  (old) commit — `v0.2.0` shipped the pre-0.2 bundle. `v0.2.1` carries the
  features below with the correct bundle and supersedes `v0.2.0`.

### Added
- `minimalistic-area-card-plus`: four new per-entity / card options, all exposed
  in the visual editor:
  - **Icon colour** (`color`) — a fixed or conditional colour for an entity's
    icon, overriding the default state colouring.
  - **Badge / pill** (`badge_icon`, `badge_color`) — a small indicator over an
    icon's top-right corner (e.g. door open, low battery, alert). A badge colour
    that resolves to empty / `none` hides the badge, so conditions can show or
    hide it.
  - **Icon size** (`icon_size`) — size as a percentage of the normal look
    (`100` = unchanged). Settable card-wide and overridable per entity.
  - **Jinja templates** — `title`, `color`, `icon`, `name`, `badge_icon`,
    `badge_color`, `image` and `background_color` now accept Home Assistant
    templates (`{{ … }}` / `{% … %}`), rendered live over the websocket and
    re-rendered when their result changes.
  - **Title styling** (`title_size`, `title_color`) — size (px or any CSS
    length) and colour for the card title. `title_color` is template-aware too.
  - **Drag-and-drop reordering** in the editor — drag the ⠿ handle on an entity
    row to reorder; the up/down arrows remain as a fallback.

## [0.1.5] - 2024-06-19

### Fixed
- `expander-card`: restore the viewport (full-width) breakout fallback for
  normal dashboards. v0.1.3 had replaced it with the card's own width, which
  broke sideways breakout on layouts where no `HUI-SECTION`/`HUI-VIEW` is
  detected (e.g. layout-card) — exactly where `breakout-margin` matters. Popup
  containment is now done only when an actual popup is detected (`ha-dialog` /
  browser_mod, Bubble Card pop-up, or `role="dialog"`): there the panel fills
  the popup; everywhere else it breaks out to the viewport as before.

## [0.1.4] - 2024-06-19

### Fixed
- `expander-card`: `breakout` now spans the **full popup width** inside dialogs.
  v0.1.3 stopped the off-screen overflow but fell back to the card's own
  (narrow) width in popups. The card now measures the popup surface
  (`ha-dialog` / browser_mod, Bubble Card pop-up, or a generic widest-bounded
  ancestor) so expanded children fill the popup by default, matching the
  full-width behaviour on a normal dashboard.

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

[0.2.4]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.4
[0.2.3]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.3
[0.2.2]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.2
[0.2.1]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.1
[0.2.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.0
[0.1.5]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.5
[0.1.4]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.4
[0.1.3]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.3
[0.1.2]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.2
[0.1.1]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.1
[0.1.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.1.0
