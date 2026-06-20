/**
 * Visual config editor for <minimalistic-area-card-plus>.
 *
 * Built on Home Assistant's own form elements (ha-form, ha-entity-picker,
 * ha-icon-picker, ha-selector) so it matches the native editor look & feel.
 *
 * Covers:
 *   - image (URL or /local/), darken_image, shadow
 *   - title, area (area selector)
 *   - an editable entities list: add / remove / reorder, and per entity
 *     entity + icon + name + tap_action
 *   - alignment controls for the bottom sensor row, the priority pain point:
 *     a text-valued state (e.g. "idle") next to numeric ones otherwise breaks
 *     the row alignment. These controls let the user line everything up.
 */

function fireEvent(node, type, detail) {
  const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
  event.detail = detail || {};
  node.dispatchEvent(event);
  return event;
}

// Top section: look & behaviour. Action fields use the native ui_action selector.
const MAIN_SCHEMA = [
  {
    name: "title",
    selector: { text: {} },
  },
  {
    type: "grid",
    schema: [
      {
        name: "title_size",
        selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "px" } },
      },
      { name: "title_color", selector: { text: {} } },
    ],
  },
  {
    name: "area",
    selector: { area: {} },
  },
  {
    type: "grid",
    schema: [
      { name: "image", selector: { text: {} } },
      { name: "camera_image", selector: { entity: { domain: "camera" } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "darken_image", selector: { boolean: {} } },
      { name: "shadow", selector: { boolean: {} } },
      { name: "state_color", selector: { boolean: {} } },
      { name: "hide_unavailable", selector: { boolean: {} } },
    ],
  },
  {
    type: "grid",
    schema: [
      {
        name: "icon_size",
        selector: { number: { min: 10, max: 400, step: 1, mode: "box", unit_of_measurement: "%" } },
      },
    ],
  },
  {
    name: "interactions",
    type: "expandable",
    iconPath:
      "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
    schema: [
      { name: "tap_action", selector: { ui_action: {} } },
      { name: "hold_action", selector: { ui_action: {} } },
      { name: "double_tap_action", selector: { ui_action: {} } },
    ],
  },
];

// Bottom section: alignment of the sensor row.
const ALIGN_SCHEMA = [
  {
    type: "grid",
    schema: [
      {
        name: "item_align",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "middle", label: "Middle (default)" },
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
              { value: "baseline", label: "Baseline" },
            ],
          },
        },
      },
      {
        name: "value_justify",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "start", label: "Left (default)" },
              { value: "center", label: "Center" },
              { value: "end", label: "Right" },
            ],
          },
        },
      },
    ],
  },
  {
    type: "grid",
    schema: [
      {
        name: "value_wrap",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "wrap", label: "Wrap (default)" },
              { value: "nowrap", label: "Truncate (…)" },
            ],
          },
        },
      },
      {
        name: "value_min_width",
        selector: { number: { min: 0, max: 200, step: 1, mode: "box", unit_of_measurement: "px" } },
      },
      {
        name: "sensor_columns",
        selector: { number: { min: 0, max: 6, step: 1, mode: "box" } },
      },
    ],
  },
];

const LABELS = {
  title: "Title",
  title_size: "Title size (px)",
  title_color: "Title colour",
  area: "Area",
  image: "Image (URL or /local/…)",
  camera_image: "Camera (optional)",
  darken_image: "Darken image",
  shadow: "Icon shadow",
  state_color: "Color icons by state",
  hide_unavailable: "Hide unavailable",
  icon_size: "Icon size (%)",
  interactions: "Card interactions",
  tap_action: "Tap action",
  hold_action: "Hold action",
  double_tap_action: "Double tap action",
  item_align: "Item vertical align",
  value_justify: "Value alignment",
  value_wrap: "Long value behaviour",
  value_min_width: "Value column width",
  sensor_columns: "Sensor columns",
};

const HELPERS = {
  title: "Plain text or a Jinja template, e.g. Salon — {{ states('sensor.temp') }}°.",
  title_color: "Named colour, #hex, or a template. Leave empty for the default.",
  icon_size: "Default icon size, as a % of the normal look. 100 = unchanged. Override per entity below.",
  item_align: "Vertical alignment of each icon + value pair in the bottom row.",
  value_justify: "How the value text sits within its column.",
  value_wrap: "Truncate keeps text on one line so rows stay aligned.",
  value_min_width: "Reserve a fixed width for values so text (e.g. “idle”) and numbers line up. 0 = auto.",
  sensor_columns: "Lay sensors out in an aligned grid of N columns. 0 = inline flow (original look).",
};

const mdiPath = {
  up: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  remove: "M19,13H5V11H19V13Z",
};

class MinimalisticAreaCardPlusEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
    this._built = false;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._mainForm) this._mainForm.hass = hass;
    if (this._alignForm) this._alignForm.hass = hass;
    if (!this._built) this._render();
    else this._refreshEntityRows();
  }

  get _entities() {
    return Array.isArray(this._config.entities) ? this._config.entities : [];
  }

  _emit(config) {
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }

  _computeLabel = (schema) => LABELS[schema.name] || schema.name;
  _computeHelper = (schema) => HELPERS[schema.name] || "";

  _render() {
    if (!this._hass) return;

    if (!this._built) {
      this.shadowRoot.innerHTML = `
        <style>
          .editor { display: flex; flex-direction: column; gap: 16px; }
          .section-title { font-weight: 600; margin: 4px 0 -4px; }
          .entities { display: flex; flex-direction: column; gap: 12px; }
          .entity-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 8px;
            align-items: end;
            border: 1px solid var(--divider-color, #e0e0e0);
            border-radius: 8px;
            padding: 8px;
          }
          .entity-row .full { grid-column: 1 / -1; }
          .entity-row .row-tools {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-end;
            gap: 2px;
            margin-top: -4px;
          }
          .add-row { display: flex; align-items: center; gap: 8px; }
          .add-row ha-entity-picker { flex: 1; }
          ha-textfield { width: 100%; }
          .hint { color: var(--secondary-text-color); font-size: 0.85em; margin-top: -8px; }
        </style>
        <div class="editor">
          <div id="main"></div>
          <div>
            <div class="section-title">Entities</div>
            <div class="hint">Drag-free reorder with the arrows; per-entity icon, name and tap action.</div>
            <div class="entities" id="entities"></div>
            <div class="add-row" id="add"></div>
          </div>
          <div>
            <div class="section-title">Sensor row alignment</div>
            <div class="hint">Keep text values (e.g. “idle”) aligned with numeric ones.</div>
            <div id="align"></div>
          </div>
        </div>
      `;

      this._mainForm = document.createElement("ha-form");
      this._mainForm.schema = MAIN_SCHEMA;
      this._mainForm.computeLabel = this._computeLabel;
      this._mainForm.computeHelper = this._computeHelper;
      this._mainForm.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._emit(ev.detail.value);
      });
      this.shadowRoot.getElementById("main").appendChild(this._mainForm);

      this._alignForm = document.createElement("ha-form");
      this._alignForm.schema = ALIGN_SCHEMA;
      this._alignForm.computeLabel = this._computeLabel;
      this._alignForm.computeHelper = this._computeHelper;
      this._alignForm.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._emit(ev.detail.value);
      });
      this.shadowRoot.getElementById("align").appendChild(this._alignForm);

      this._entitiesEl = this.shadowRoot.getElementById("entities");
      this._addEl = this.shadowRoot.getElementById("add");

      this._built = true;
    }

    // Forms share the whole config object as their data; each only writes the
    // keys it owns and preserves the rest (including entities).
    this._mainForm.hass = this._hass;
    this._mainForm.data = this._config;
    this._alignForm.hass = this._hass;
    this._alignForm.data = this._config;

    this._renderEntities();
    this._renderAddRow();
  }

  /* ----- entities list ----- */

  _renderEntities() {
    const list = this._entities;
    this._entitiesEl.innerHTML = "";
    list.forEach((item, index) => {
      this._entitiesEl.appendChild(this._buildEntityRow(item, index, list.length));
    });
  }

  _buildEntityRow(item, index, count) {
    const conf = typeof item === "string" ? { entity: item } : { ...item };

    const row = document.createElement("div");
    row.className = "entity-row";

    const entityPicker = document.createElement("ha-entity-picker");
    entityPicker.hass = this._hass;
    entityPicker.value = conf.entity || "";
    entityPicker.label = "Entity";
    entityPicker.allowCustomEntity = true;
    entityPicker.classList.add("full");
    entityPicker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._updateEntity(index, "entity", ev.detail.value);
    });
    row.appendChild(entityPicker);

    const iconPicker = document.createElement("ha-icon-picker");
    iconPicker.hass = this._hass;
    iconPicker.value = conf.icon || "";
    iconPicker.label = "Icon (optional)";
    iconPicker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._updateEntity(index, "icon", ev.detail.value);
    });
    row.appendChild(iconPicker);

    const nameField = document.createElement("ha-textfield");
    nameField.label = "Name (optional)";
    nameField.value = conf.name || "";
    nameField.addEventListener("input", (ev) => {
      this._updateEntity(index, "name", ev.target.value, /* silent */ true);
    });
    nameField.addEventListener("change", (ev) => {
      this._updateEntity(index, "name", ev.target.value);
    });
    row.appendChild(nameField);

    const advancedHint = document.createElement("div");
    advancedHint.className = "full hint";
    advancedHint.textContent = "Colour, size & badge — Jinja templates ({{ … }}) allowed for colour, icon & badge.";
    row.appendChild(advancedHint);

    const colorField = document.createElement("ha-textfield");
    colorField.label = "Icon colour (optional)";
    colorField.value = conf.color || "";
    colorField.addEventListener("input", (ev) => {
      this._updateEntity(index, "color", ev.target.value, /* silent */ true);
    });
    colorField.addEventListener("change", (ev) => {
      this._updateEntity(index, "color", ev.target.value);
    });
    row.appendChild(colorField);

    const sizeField = document.createElement("ha-textfield");
    sizeField.label = "Icon size %";
    sizeField.type = "number";
    sizeField.value = conf.icon_size != null ? conf.icon_size : "";
    const sizeVal = (raw) => (raw === "" || raw == null ? "" : Number(raw));
    sizeField.addEventListener("input", (ev) => {
      this._updateEntity(index, "icon_size", sizeVal(ev.target.value), /* silent */ true);
    });
    sizeField.addEventListener("change", (ev) => {
      this._updateEntity(index, "icon_size", sizeVal(ev.target.value));
    });
    row.appendChild(sizeField);

    const badgeIconPicker = document.createElement("ha-icon-picker");
    badgeIconPicker.hass = this._hass;
    badgeIconPicker.value = conf.badge_icon || "";
    badgeIconPicker.label = "Badge icon (optional)";
    badgeIconPicker.classList.add("full");
    badgeIconPicker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._updateEntity(index, "badge_icon", ev.detail.value);
    });
    row.appendChild(badgeIconPicker);

    const badgeColorField = document.createElement("ha-textfield");
    badgeColorField.label = "Badge colour / condition (optional)";
    badgeColorField.classList.add("full");
    badgeColorField.value = conf.badge_color || "";
    badgeColorField.addEventListener("input", (ev) => {
      this._updateEntity(index, "badge_color", ev.target.value, /* silent */ true);
    });
    badgeColorField.addEventListener("change", (ev) => {
      this._updateEntity(index, "badge_color", ev.target.value);
    });
    row.appendChild(badgeColorField);

    const actionSelector = document.createElement("ha-selector");
    actionSelector.hass = this._hass;
    actionSelector.selector = { ui_action: {} };
    actionSelector.value = conf.tap_action;
    actionSelector.label = "Tap action";
    actionSelector.classList.add("full");
    actionSelector.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._updateEntity(index, "tap_action", ev.detail.value);
    });
    row.appendChild(actionSelector);

    // Reorder / remove tools
    const tools = document.createElement("div");
    tools.className = "row-tools";
    tools.appendChild(this._toolButton(mdiPath.up, "Move up", index === 0, () => this._move(index, -1)));
    tools.appendChild(this._toolButton(mdiPath.down, "Move down", index === count - 1, () => this._move(index, 1)));
    tools.appendChild(this._toolButton(mdiPath.remove, "Remove", false, () => this._remove(index)));
    row.appendChild(tools);

    row._entityPicker = entityPicker;
    row._iconPicker = iconPicker;
    row._badgeIconPicker = badgeIconPicker;
    return row;
  }

  _toolButton(path, label, disabled, onClick) {
    const btn = document.createElement("ha-icon-button");
    btn.label = label;
    btn.disabled = disabled;
    const icon = document.createElement("ha-svg-icon");
    icon.path = path;
    btn.appendChild(icon);
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!disabled) onClick();
    });
    return btn;
  }

  _renderAddRow() {
    this._addEl.innerHTML = "";
    const picker = document.createElement("ha-entity-picker");
    picker.hass = this._hass;
    picker.label = "Add entity";
    picker.allowCustomEntity = true;
    picker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const value = ev.detail.value;
      if (!value) return;
      const entities = [...this._entities, value];
      picker.value = "";
      this._emit({ ...this._config, entities });
      this._renderEntities();
    });
    this._addEl.appendChild(picker);
  }

  // Refresh hass on existing pickers without rebuilding (keeps focus/typing).
  _refreshEntityRows() {
    if (!this._entitiesEl) return;
    for (const row of this._entitiesEl.children) {
      if (row._entityPicker) row._entityPicker.hass = this._hass;
      if (row._iconPicker) row._iconPicker.hass = this._hass;
      if (row._badgeIconPicker) row._badgeIconPicker.hass = this._hass;
    }
  }

  _normalizeEntity(item) {
    return typeof item === "string" ? { entity: item } : { ...item };
  }

  _updateEntity(index, key, value, silent) {
    const entities = this._entities.map((e) => this._normalizeEntity(e));
    if (!entities[index]) return;
    if (value === "" || value === undefined || value === null) {
      delete entities[index][key];
    } else {
      entities[index][key] = value;
    }
    // Collapse {entity: "x"} back to a bare string for tidiness.
    const collapsed = entities.map((e) => (Object.keys(e).length === 1 && e.entity ? e.entity : e));
    this._emit({ ...this._config, entities: collapsed });
    // Don't re-render on every keystroke — keeps textfield focus.
    if (silent) return;
  }

  _move(index, delta) {
    const entities = [...this._entities];
    const target = index + delta;
    if (target < 0 || target >= entities.length) return;
    const [moved] = entities.splice(index, 1);
    entities.splice(target, 0, moved);
    this._emit({ ...this._config, entities });
    this._renderEntities();
  }

  _remove(index) {
    const entities = [...this._entities];
    entities.splice(index, 1);
    this._emit({ ...this._config, entities });
    this._renderEntities();
  }
}

export { MinimalisticAreaCardPlusEditor };
