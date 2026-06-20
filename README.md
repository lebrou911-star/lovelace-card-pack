# Lovelace Card Pack

A pack of custom [Home Assistant](https://www.home-assistant.io/) Lovelace cards,
bundled into **one JavaScript file** and installable in a single shot via HACS —
the same approach used by [Mushroom](https://github.com/piitaya/lovelace-mushroom)
and [Bubble Card](https://github.com/Clooos/Bubble-Card).

Add the pack once and every card inside it shows up in the Home Assistant card
picker.

## Cards in this pack

| Card | Lovelace `type` | What it does |
| ---- | --------------- | ------------ |
| **Expander Card** | `custom:expander-card` | A header card that slides open to reveal child cards underneath. Has a built-in visual editor. |
| **Minimalistic Area Card Plus** | `custom:minimalistic-area-card-plus` | A minimalistic area card (area picture / camera + a row of entity icons and sensor values) with a full visual editor and **alignment controls** for the bottom sensor row. Fork of [junalmeida's Minimalistic Area Card](https://github.com/junalmeida/homeassistant-minimalistic-area-card). |

## Installation (HACS — custom repository)

1. In Home Assistant, open **HACS**.
2. Top-right menu (⋮) → **Custom repositories**.
3. Add the repository URL `https://github.com/lebrou911-star/lovelace-card-pack`
   with category **Dashboard** (a.k.a. *Lovelace* / *Plugin*).
4. Find **Lovelace Card Pack** in HACS and click **Download**.
5. HACS adds the Lovelace resource automatically. If you ever need to add it
   manually (**Settings → Dashboards → ⋮ → Resources → Add resource**), use:

   ```
   URL:  /hacsfiles/lovelace-card-pack/lovelace-card-pack.js
   Type: JavaScript Module
   ```

6. Hard-refresh your browser (Ctrl/Cmd-Shift-R) so the new resource loads.

> The pack ships the pre-built bundle in `dist/`, so HACS serves it directly —
> no build step required to install.

## Usage

Each card can be added from the dashboard **card picker** ("Add card" → search
for *Expander* or *Minimalistic Area*), or by editing YAML directly.

### Minimalistic Area Card Plus

```yaml
type: custom:minimalistic-area-card-plus
title: Living Room         # plain text or a template, e.g. "Salon — {{ states('sensor.temp') }}°"
title_size: 24             # px (or any CSS length); omit for the default
title_color: white         # named colour, #hex, or a template
area: living_room          # optional; auto-fills entities from the area
image: /local/rooms/living_room.jpg   # or a full URL; omit to use the area picture
darken_image: true
shadow: true
icon_size: 100             # default icon size, % of the normal look (100 = unchanged)
entities:
  - light.living_room
  - switch.tv
  - entity: sensor.living_room_temperature
    name: Temp
  - entity: sensor.living_room_humidity
    icon: mdi:water-percent
  # --- per-entity colour, size, badge & templates (the new bits) ---
  - entity: light.desk
    color: amber                       # fixed icon colour…
    icon_size: 130                     # …bigger than the rest
  - entity: binary_sensor.front_door
    # conditional colour + a badge that only shows when the door is open
    color: "{{ 'red' if is_state('binary_sensor.front_door','on') else 'grey' }}"
    badge_icon: mdi:alert
    badge_color: "{{ 'red' if is_state('binary_sensor.front_door','on') else 'none' }}"
  - entity: sensor.phone_battery
    # badge appears only when the battery is low
    badge_color: "{{ 'orange' if states('sensor.phone_battery')|int < 20 else 'none' }}"
  - entity: media_player.living_room   # text state like "idle"
# --- bottom sensor row alignment (the painful part, solved) ---
item_align: middle         # top | middle | bottom | baseline
value_justify: start       # start | center | end
value_wrap: nowrap         # wrap | nowrap (truncate with …)
value_min_width: 48        # px; reserve a column so text & numbers line up (0 = auto)
sensor_columns: 0          # 0 = inline flow; N = aligned grid of N columns
```

#### Alignment controls

A sensor whose value is **text** (for example a media player showing `idle`)
otherwise pushes the bottom row out of alignment compared to neighbouring
**numeric** values. These options fix that — all of them are exposed in the
visual editor:

| Option | Values | Effect |
| ------ | ------ | ------ |
| `item_align` | `top` / `middle` / `bottom` / `baseline` | Vertical alignment of each icon + value pair. |
| `value_justify` | `start` / `center` / `end` | How the value text sits in its column. |
| `value_wrap` | `wrap` / `nowrap` | `nowrap` keeps each value on one line (truncated with `…`) so rows stay even. |
| `value_min_width` | px (`0` = auto) | Reserve a fixed width for the value, so `idle` and `21.4 °C` line up. |
| `sensor_columns` | `0` = inline, `N` = grid | Lay sensors out in an aligned grid of `N` columns. |

#### Per-entity colour, badges, size & templates

These options live on each entry in `entities:` (and `icon_size` also works
card-wide). All are in the visual editor too.

| Option | Scope | Effect |
| ------ | ----- | ------ |
| `color` | per entity | Fixed or conditional icon colour (named, `#hex`, or a template). Overrides the default state colouring. |
| `icon_size` | card + per entity | Icon size as a **%** of the normal look. `100` = unchanged; per-entity value overrides the card default. |
| `badge_icon` | per entity | Optional `mdi:` icon shown in a small badge over the icon's top-right corner. |
| `badge_color` | per entity | Badge colour. A value of `none` / `transparent` / empty **hides** the badge — pair with a template for conditional alerts (door open, low battery…). |

**Templates** — `title`, `title_color`, `color`, `icon`, `name`, `badge_icon`,
`badge_color`, `image` and `background_color` accept [Home Assistant Jinja templates](https://www.home-assistant.io/docs/configuration/templating/).
They render live over the websocket and update the card whenever their result
changes:

```yaml
- entity: binary_sensor.front_door
  color: "{{ 'red' if is_state('binary_sensor.front_door','on') else 'grey' }}"
  badge_icon: mdi:alert
  badge_color: "{{ 'red' if is_state('binary_sensor.front_door','on') else 'none' }}"
```

Config keys map directly to the visual editor, so you can switch between UI and
YAML freely.

### Expander Card

```yaml
type: custom:expander-card
title: More controls
expanded: false
cards:
  - type: entities
    entities:
      - light.kitchen
      - light.hallway
```

See the in-card visual editor for all options.

## ⚠️ Conflicts with separately-installed cards

This pack **bundles its own copies** of the cards. A custom element can only be
registered once per browser session, so do not also load a standalone copy of
the same element:

- **Expander Card** — this pack registers the element name **`expander-card`**,
  intentionally replacing the old standalone `card-expander-` repo. If you still
  have that old card installed as a separate HACS resource, you'll get a
  `customElements.define` collision. **Remove the old standalone Expander Card
  HACS resource** and use the one from this pack.
- **Minimalistic Area Card** — this pack registers
  **`minimalistic-area-card-plus`** (a different name), so it does **not**
  conflict with a separate install of the original `minimalistic-area-card`.
  You can run both side by side.

## Development

```bash
npm install      # install esbuild
npm run build    # one-shot build  -> dist/lovelace-card-pack.js
npm run watch    # rebuild on change
```

- Source lives in `src/`, one folder per card. `src/index.js` imports each card
  for its side effects (every card calls `customElements.define()` itself and
  pushes an entry onto `window.customCards`).
- The build produces a single IIFE bundle, `dist/lovelace-card-pack.js`, which
  is committed so HACS can serve it.
- The pack version comes from `package.json`. On push to `main`, the GitHub
  Actions release workflow tags `vX.Y.Z` and publishes a release.

## Credits & license

- **Minimalistic Area Card Plus** is a fork of
  [homeassistant-minimalistic-area-card](https://github.com/junalmeida/homeassistant-minimalistic-area-card)
  by Marcos Junior (**junalmeida**) — original work © 2020 Custom cards for Home
  Assistant. Thank you!
- Everything here is released under the [MIT License](./LICENSE).
