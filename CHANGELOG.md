# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.15.0] - 2026-06-27

### Changed
- **`minimalistic-area-card-extender`** editor: each section is now a
  **collapsible panel** (title + arrow, via `ha-expansion-panel`) — "Apparence"
  (open by default), "Expander (comportement)", and "Contenu déroulé" (collapsed)
  — so you no longer scroll endlessly. Falls back to `<details>` if the panel
  component isn't loaded.

## [0.14.5] - 2026-06-27

### Fixed
- **`minimalistic-area-card-extender`** editor: editing the visual part (e.g.
  removing an entity) dropped the card's `type`, causing a "No type provided"
  Configuration error and a fall back to the YAML editor. The embedded
  minimalistic editor emits its own `type`, which was deleted without restoring
  the extender's `type`. The handler now preserves
  `custom:minimalistic-area-card-extender`.

## [0.14.4] - 2026-06-27

### Fixed
- **`minimalistic-area-card-extender`**: reverted the `getGridOptions()` churn —
  the card has none again, exactly like `expander-card`. The missing "Layout"
  tab / full-width header was never a card bug: the **Layout tab and `columns`
  only exist in **Sections** views**, and the demo was a masonry view. In a
  Sections view the extender gets the Layout tab and honours `grid_options.columns`
  natively (header at chosen width, `breakout: true` for full-width content).

## [0.14.3] - 2026-06-27

### Fixed
- (Superseded by 0.14.4.) Attempted a full `getGridOptions()`; the real issue was
  the demo view type (masonry vs sections), not the card.

## [0.14.2] - 2026-06-27

### Fixed
- **`minimalistic-area-card-extender`**: removed `getGridOptions()` entirely.
  Merely defining the method (even returning the config) made HA's Sections view
  fall back to full (12-col) width, ignoring `grid_options.columns`. Like
  `expander-card`/`minimalistic-area-card-plus` (which never defined it), leaving
  it undefined lets HA honour `grid_options: { columns: 6 }` natively — header at
  half width, with `breakout: true` for full-width revealed content.

## [0.14.1] - 2026-06-27

### Fixed
- **`minimalistic-area-card-extender`**: first attempt at the grid fix (returning
  the config from `getGridOptions`), superseded by 0.14.2 which removes the
  method outright.

## [0.14.0] - 2026-06-27

### Changed
- **`minimalistic-area-card-extender`** is now dual-mode, chosen by config:
  - set **`cards:`** → **self-contained**: the minimalistic card reveals those
    children **inline right below itself** (wraps `expander-card`; supports
    `child-layout` incl. `grid`, `gap`, `expanded`, `expand-on`, `group`,
    `border-color`). One card holds everything, so it can be placed anywhere and
    the content always opens directly under the header — the robust way to get
    "inline below + place anywhere".
  - set **`hash:`** (no `cards`) → **trigger**: opens a separate `expander-child`
    with the same hash and shows the accent border while open.
  The editor exposes the minimalistic visuals + these options + a stack editor
  for the inline content.

## [0.13.1] - 2026-06-27

### Fixed
- **`expander-child`** (expander-pair 0.6.0): the collapsed placeholder marker is
  now shown **only while editing** the dashboard (URL `?edit=1`) — it is fully
  invisible in normal/deployed view (previously the dashed marker showed even
  when not expanded). `getCardSize` returns 0 while collapsed so it reserves no
  space.

## [0.13.0] - 2026-06-27

### Changed
- **`minimalistic-area-card-extender`** is now the **trigger** half of the
  two-card pattern (keeping the separate `expander-child`), not a self-contained
  card. Give it a `hash` (e.g. `#garage`) and it wires up, on the underlying
  `minimalistic-area-card-plus`, the tap → navigate to that hash (so the matching
  `expander-child` reveals/collapses inline) **and** the accent `active_border`
  while the child is open. Everything else is a normal minimalistic card. Its
  editor is the full minimalistic editor plus a single "Linked popup" hash field.

## [0.12.0] - 2026-06-27

### Added
- **`minimalistic-area-card-extender`** (`custom:minimalistic-area-card-extender`):
  first cut as a self-contained minimalistic-plus + inline expander (superseded
  by 0.13.0's trigger model below).

## [0.11.0] - 2026-06-27

### Added
- **`minimalistic-area-card-plus`**: new `active_border` option. When set, the
  card shows an accent outline (default theme `--accent-color`, i.e. orange; or
  pass a CSS colour string) while its linked popup is open — i.e. while the URL
  hash equals the card's `tap_action` navigate target (or an explicit
  `active_hash`). This mirrors the original expander lighting up its header when
  expanded. The card now listens for hash/navigation changes to toggle it live.

## [0.10.0] - 2026-06-27

### Removed
- **`custom:expander-header`** is dropped. It is unnecessary: any normal (styled)
  card — e.g. a `minimalistic-area-card-plus` — opens the child via
  `tap_action: { action: navigate, navigation_path: "#hash" }`, and that card
  keeps its own border/colour/image styling. The pack now ships a single
  `custom:expander-child` (expander-pair 0.5.0); its runtime/editor are unchanged.

## [0.9.1] - 2026-06-27

### Fixed
- **`expander-child`** (expander-pair 0.4.1): re-tapping the trigger now toggles
  cleanly — tap to open, re-tap to collapse, tap again to reopen (like the
  original expander). Navigation events to the hash are debounced (250 ms) so a
  single tap's burst of `location-changed` + `hashchange` counts as one toggle
  (no flicker), and collapsing clears the hash from the URL without leaving
  stray history entries.

## [0.9.0] - 2026-06-27

### Changed
- **`expander-child`** (expander-pair 0.4.0): the content now reveals **inline
  (accordion)** right where the card sits — pushing the cards below it down —
  instead of sliding up as a floating popup/dialog. This matches the original
  expander behaviour. Height animates via `grid-template-rows` (0fr → 1fr). A
  collapse bar (title + ▲) closes it (toggle with `show_header: false`); Back and
  Escape still collapse it. The `width` option is dropped (no longer an overlay);
  `placeholder`/`show_header` control the collapsed marker and the bar.

## [0.8.0] - 2026-06-27

### Changed
- **`expander-child`** (expander-pair 0.3.0): its content is now edited **exactly
  like a stack**. The editor mounts HA's native card editor on a
  `vertical-stack`, so you get the real add / pick-type / edit-one-at-a-time UI
  with collapsed ("hidden") sub-cards — instead of a single-card editor. Content
  is stored as `cards: [...]` (a legacy single `card:` is still read and migrated
  on first edit). Runtime renders the cards inside a vertical-stack.

## [0.7.0] - 2026-06-27

### Added
- **Expander pair** (`expander-pair` 0.2.0) — two separate cards that together
  behave like a Bubble Card pop-up, kept apart on purpose to avoid confusion:
  - **`custom:expander-header`** — the always-visible button. Tapping it opens
    the popup by navigating to a URL hash (e.g. `#garage`).
  - **`custom:expander-child`** — the popup content. Hidden (takes no layout
    space; an editor placeholder can be toggled) until the URL hash matches its
    `hash`; then it slides up as a dialog. Its content is a **single normal
    card** (`card:`), edited exactly like any other card; use a
    `vertical-stack`/`grid` for several children.

  Link the two by giving them the same `hash`. The browser Back button, a click
  on the backdrop, or Escape closes the child. The existing `expander-card` is
  left untouched.

### Removed
- The short-lived `custom:cardpack-popup` (0.6.0) is replaced by the
  header/child pair above.

## [0.5.3] - 2026-06-27

### Changed
- `expander-card` (0.23.0) editor: the child-cards editor is now **navigation
  based** (true Bubble Card style). A LIST screen shows one light row per child
  card (type + move / edit / delete, no nested editor mounted at all); clicking
  a row or the pencil **navigates** to an EDIT screen that swaps the whole area
  for that single card's editor plus a **← Back** button. Only one editor is
  ever mounted at a time. Adding a card via the picker jumps straight into its
  EDIT screen. Editing only touches `cards`, so `child-layout` (incl. `grid`)
  is preserved; runtime rendering is unchanged.

## [0.5.2] - 2026-06-20

### Changed
- `expander-card` (0.22.0) editor: the child-cards section now uses the lazy
  collapsed list as the **primary** editor (Bubble Card style) instead of HA's
  `hui-stack-card-editor`. Each card is a collapsed row (type + move / edit /
  delete); the real per-card editor mounts only for the card you open (one at a
  time), others show "Content is hidden for performance reasons." Editing only
  touches `cards`, so `child-layout` (incl. `grid`) is preserved — which also
  makes the previous stack-editor `keepLayout` workaround unnecessary. The card
  picker (add) is kept; runtime rendering is unchanged.

## [0.5.1] - 2026-06-20

### Fixed
- `expander-card` editor: editing the child cards no longer reset
  `child-layout: grid` back to `vertical`. The stack-editor handler now only
  syncs the layout from the stack type when it's currently `vertical`/
  `horizontal`, and preserves any other value (e.g. `grid`).

### Changed
- `expander-card` (0.21.0) editor: the fallback "Child cards" list (used when
  HA's `hui-stack-card-editor` isn't available) is now lazy — a collapsed list
  with a light "Content hidden for performance reasons" placeholder per card,
  and the real editor mounts only for the card you open (one at a time, via the
  pencil button). Add / move / delete and the card picker are unchanged. The
  primary `hui-stack-card-editor` path is untouched, and the runtime card
  rendering (incl. the `grid` layout) is unaffected.

## [0.5.0] - 2026-06-20

### Added
- `expander-card` (0.20.0): new `child-layout: grid` option. Children are laid
  out on a native-HA **12-column grid**, each card spanning its
  `grid_options.columns` (a card with no `grid_options` spans full width). Lets
  you paste a pop-up / HA section's cards into the expander and keep the same
  layout, without rebuilding widths with nested stacks. Heights
  (`grid_options.rows`) are intentionally left to content (`grid-auto-rows:
  auto`). Existing `vertical` / `horizontal` / `columns: N` layouts are
  unchanged.

## [0.4.2] - 2026-06-20

### Changed
- `minimalistic-area-card-plus`: tap/hold action **confirmations** now use a
  themed in-card modal instead of the browser's native `window.confirm`. It
  follows the HA theme (card background, accent button), shows the
  `confirmation.text`, and supports Esc = cancel, Enter = confirm, click-outside
  = cancel. Button labels default to "Annuler" / "Confirmer".

## [0.4.1] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus`: closing a more-info dialog opened from an icon
  left the card content/image slightly shifted. Focus returned to the icon
  button and the browser scrolled it into view inside the `overflow: hidden`
  card (which blocks visible but not programmatic scrolling). The card now uses
  `overflow: clip` (plus a scroll-reset fallback) so the content can't be nudged.

## [0.4.0] - 2026-06-20

### Added
- `minimalistic-area-card-plus`: entity-less **shortcut buttons**. An entry with
  no `entity` but an `icon` and/or a `tap_action` now renders as a plain icon
  button in the action row — handy for navigation links (Config, Logs, HACS…) or
  service calls. Honours `color`, `icon_size`, badge and templates like other
  icons.

## [0.3.2] - 2026-06-20

### Added
- `minimalistic-area-card-plus` editor: per-entity **"Ask for confirmation on
  tap"** checkbox plus a confirmation-text field (in the Advanced section), so a
  tap confirmation can be set from the UI instead of YAML. Enabling it keeps the
  entity's existing or default action (e.g. toggle) and adds the confirmation;
  the action selector no longer wipes a confirmation set this way.

## [0.3.1] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus` editor: choosing a per-entity "Tap action" did
  nothing — the selection cleared itself. Since 0.2.5 the editor suppresses the
  row rebuild (to keep input focus), so the `ui_action` selector no longer got
  its value refreshed. It now feeds the chosen value back to itself, so the
  selection sticks.

## [0.3.0] - 2026-06-20

### Added
- `minimalistic-area-card-plus`: tap / hold / double-tap actions now honour a
  `confirmation` option, like native Home Assistant actions — e.g.
  `tap_action: { action: toggle, confirmation: { text: "…" } }` pops a confirm
  prompt before toggling. Supports `confirmation.text` and
  `confirmation.exemptions` (users who skip the prompt).

## [0.2.9] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus`: a `camera_image` now fills the whole card and
  crops like a static image. It used to render at the camera's natural aspect
  ratio (width 100%, height auto, vertically centred), leaving black bands. The
  `hui-image` is now set to `fitMode: "cover"` and stretched to full height.

## [0.2.8] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus`: a sensor value could be glued to its icon when
  the icon glyph is wide (e.g. `mdi:pump`), while narrow glyphs kept a small
  gap. The fixed `-9px` pull on the value didn't allow for glyph width;
  loosened to `-6px` so every value keeps a small space from its icon.

## [0.2.7] - 2026-06-20

### Changed
- `minimalistic-area-card-plus`: the bottom control-icon row is now flush in the
  bottom-right corner and bottom-aligned. It was `display:block` +
  `text-align:right` with 10px bottom padding, so icons of different sizes
  (e.g. an entity with `icon_size: 120`) didn't line up and the row floated a
  little above the corner. It is now a flex row (`justify-content:flex-end`,
  `align-items:flex-end`) with minimal padding, so the icons sit together in the
  corner on every card.

## [0.2.6] - 2026-06-20

### Changed
- `minimalistic-area-card-plus` editor: each entity row is simpler again. By
  default it shows only Entity, Icon, Name and Tap action; colour, icon size,
  badge and the Jinja template fields are tucked into a collapsible "Advanced"
  section per row. The "Sensor row alignment" block is now collapsible too.

## [0.2.5] - 2026-06-20

### Fixed
- `minimalistic-area-card-plus` editor: the per-entity text fields really were
  not showing — `ha-textfield` is not reliably registered inside a card-editor
  context, so those fields (Name, Icon template, Icon colour, Icon size, Badge
  icon template, Badge colour) rendered as empty invisible elements regardless
  of `outlined`. Replaced them with styled native `<input>` fields (no
  dependency on `ha-textfield`), so they always show. Typing no longer rebuilds
  the rows, so focus is kept.

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

[0.5.2]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.5.2
[0.5.1]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.5.1
[0.5.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.5.0
[0.4.2]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.4.2
[0.4.1]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.4.1
[0.4.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.4.0
[0.3.2]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.3.2
[0.3.1]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.3.1
[0.3.0]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.3.0
[0.2.9]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.9
[0.2.8]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.8
[0.2.7]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.7
[0.2.6]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.6
[0.2.5]: https://github.com/lebrou911-star/lovelace-card-pack/releases/tag/v0.2.5
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
