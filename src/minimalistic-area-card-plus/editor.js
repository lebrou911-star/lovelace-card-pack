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

// True if a value looks like a Home Assistant Jinja template. Used to decide
// whether an icon belongs in the icon picker (static) or the template field.
function isTemplate(v) {
  return typeof v === "string" && /\{\{|\{%|\{#/.test(v);
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
  drag: "M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z",
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
    // If HA echoes this back via setConfig, don't rebuild the entity rows —
    // that would steal focus from the field being typed in.
    this._skipEntityRebuild = true;
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
          .section-title { font-weight: 600; margin: 8px 0 4px; }
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
          .entity-row .drag-handle { cursor: grab; margin-right: auto; }
          .entity-row.dragging { opacity: 0.5; }
          .entity-row.drop-before { box-shadow: 0 -3px 0 0 var(--primary-color, #03a9f4); }
          .entity-row.drop-after { box-shadow: 0 3px 0 0 var(--primary-color, #03a9f4); }
          .add-row { display: flex; align-items: center; gap: 8px; }
          .add-row ha-entity-picker { flex: 1; }
          ha-textfield { width: 100%; }
          /* Native text fields (ha-textfield isn't always registered in a card
             editor context, so it can render invisibly — these always show). */
          .field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
          .field label { font-size: 0.8em; color: var(--secondary-text-color); }
          .field input {
            width: 100%;
            box-sizing: border-box;
            background: var(--secondary-background-color, rgba(255,255,255,0.06));
            color: var(--primary-text-color, #fff);
            border: 1px solid var(--divider-color, #5b5b5b);
            border-radius: 6px;
            padding: 10px 12px;
            font-size: 14px;
            font-family: inherit;
          }
          .field input::placeholder { color: var(--disabled-text-color, #888); }
          .field input:focus { outline: none; border-color: var(--primary-color, #03a9f4); }
          .hint { color: var(--secondary-text-color); font-size: 0.85em; margin: 0 0 4px; line-height: 1.3; }
          details > summary { cursor: pointer; user-select: none; list-style: none; padding: 4px 0; }
          details > summary::-webkit-details-marker { display: none; }
          details > summary::before {
            content: "▸"; display: inline-block; margin-right: 6px;
            transition: transform 0.15s; color: var(--secondary-text-color);
          }
          details[open] > summary::before { transform: rotate(90deg); }
          details.adv { grid-column: 1 / -1; }
          details.adv > summary { font-size: 0.9em; color: var(--secondary-text-color); }
          .adv-body { display: flex; flex-direction: column; gap: 10px; padding: 8px 0 4px; }
          .adv-body ha-icon-picker { width: 100%; display: block; }
          details.section > summary { font-weight: 600; }
        </style>
        <div class="editor">
          <div id="main"></div>
          <div>
            <div class="section-title">Entities</div>
            <div class="hint">Reorder by dragging the ⠿ handle (or the arrows). Tap “Advanced” on a row for colour, size, badge & templates.</div>
            <div class="entities" id="entities"></div>
            <div class="add-row" id="add"></div>
          </div>
          <details class="section">
            <summary>Sensor row alignment</summary>
            <div class="hint">Keep text values (e.g. “idle”) aligned with numeric ones.</div>
            <div id="align"></div>
          </details>
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

    if (this._skipEntityRebuild) this._skipEntityRebuild = false;
    else this._renderEntities();
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

  // A labelled native <input> wrapped in .field. onInput receives the raw
  // string value. Returns the wrapper (its .input is the input element).
  _field(labelText, value, onInput, opts = {}) {
    const wrap = document.createElement("div");
    wrap.className = "field" + (opts.full ? " full" : "");
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = opts.type || "text";
    if (opts.type === "number") {
      input.inputMode = "numeric";
      if (opts.min != null) input.min = String(opts.min);
      if (opts.max != null) input.max = String(opts.max);
    }
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.value = value == null ? "" : String(value);
    input.addEventListener("input", () => onInput(input.value));
    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.input = input;
    return wrap;
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

    const iconIsTpl = isTemplate(conf.icon);
    const iconPicker = document.createElement("ha-icon-picker");
    iconPicker.hass = this._hass;
    iconPicker.value = iconIsTpl ? "" : conf.icon || "";
    iconPicker.label = "Icon (optional)";
    iconPicker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const v = ev.detail.value;
      // Don't let a spurious empty pick wipe a template typed in the field below.
      const current = this._normalizeEntity(this._entities[index] || {}).icon;
      if (!v && isTemplate(current)) return;
      this._updateEntity(index, "icon", v);
    });
    row.appendChild(iconPicker);

    const nameField = this._field("Name (optional)", conf.name || "", (v) =>
      this._updateEntity(index, "name", v, /* silent */ true)
    );
    row.appendChild(nameField);

    // Advanced options, collapsed by default so each row stays simple.
    const adv = document.createElement("details");
    adv.className = "adv full";
    const advSummary = document.createElement("summary");
    advSummary.textContent = "Advanced — colour, size, badge, templates";
    adv.appendChild(advSummary);
    const advBody = document.createElement("div");
    advBody.className = "adv-body";
    adv.appendChild(advBody);

    const advHint = document.createElement("div");
    advHint.className = "hint";
    advHint.textContent =
      "Pick a static icon above, or type a Jinja template ({{ … }}) below. Colour & badge colour also accept templates.";
    advBody.appendChild(advHint);

    // Template alternative to the icon picker. Whichever is filled wins; a
    // template ({{ … }}) lives here, a static mdi icon lives in the picker.
    const iconTpl = this._field(
      "Icon (template {{ }})",
      iconIsTpl ? conf.icon : "",
      (v) => this._updateEntity(index, "icon", v, /* silent */ true),
      { placeholder: "{{ 'mdi:fire' if ... }}" }
    );
    advBody.appendChild(iconTpl);

    const colorField = this._field(
      "Icon colour (optional)",
      conf.color || "",
      (v) => this._updateEntity(index, "color", v, /* silent */ true),
      { placeholder: "amber / #ff9800 / {{ … }}" }
    );
    advBody.appendChild(colorField);

    const sizeField = this._field(
      "Icon size %",
      conf.icon_size != null ? conf.icon_size : "",
      (v) => this._updateEntity(index, "icon_size", v === "" ? "" : Number(v), /* silent */ true),
      { type: "number", min: 10, max: 400 }
    );
    advBody.appendChild(sizeField);

    const badgeIsTpl = isTemplate(conf.badge_icon);
    const badgeIconPicker = document.createElement("ha-icon-picker");
    badgeIconPicker.hass = this._hass;
    badgeIconPicker.value = badgeIsTpl ? "" : conf.badge_icon || "";
    badgeIconPicker.label = "Badge icon (optional)";
    badgeIconPicker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const v = ev.detail.value;
      const current = this._normalizeEntity(this._entities[index] || {}).badge_icon;
      if (!v && isTemplate(current)) return;
      this._updateEntity(index, "badge_icon", v);
    });
    advBody.appendChild(badgeIconPicker);

    const badgeIconTpl = this._field(
      "Badge icon (template {{ }})",
      badgeIsTpl ? conf.badge_icon : "",
      (v) => this._updateEntity(index, "badge_icon", v, /* silent */ true),
      { placeholder: "{{ 'mdi:alert' if ... }}" }
    );
    advBody.appendChild(badgeIconTpl);

    const badgeColorField = this._field(
      "Badge colour / condition (optional)",
      conf.badge_color || "",
      (v) => this._updateEntity(index, "badge_color", v, /* silent */ true),
      { placeholder: "red / {{ 'red' if ... else 'none' }}" }
    );
    advBody.appendChild(badgeColorField);

    row.appendChild(adv);

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

    // Drag handle: only the handle arms dragging, so the form fields inside the
    // row stay fully usable (text selection, etc.). Arrows remain as a fallback.
    const dragHandle = this._toolButton(mdiPath.drag, "Drag to reorder", false, () => {});
    dragHandle.classList.add("drag-handle");
    dragHandle.addEventListener("pointerdown", () => {
      row.draggable = true;
    });
    const disarm = () => {
      row.draggable = false;
    };
    dragHandle.addEventListener("pointerup", disarm);
    dragHandle.addEventListener("pointercancel", disarm);
    tools.appendChild(dragHandle);

    tools.appendChild(this._toolButton(mdiPath.up, "Move up", index === 0, () => this._move(index, -1)));
    tools.appendChild(this._toolButton(mdiPath.down, "Move down", index === count - 1, () => this._move(index, 1)));
    tools.appendChild(this._toolButton(mdiPath.remove, "Remove", false, () => this._remove(index)));
    row.appendChild(tools);

    // HTML5 drag-and-drop reordering.
    row.addEventListener("dragstart", (ev) => {
      this._dragIndex = index;
      row.classList.add("dragging");
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = "move";
        // Firefox needs data set for the drag to start.
        try {
          ev.dataTransfer.setData("text/plain", String(index));
        } catch (_e) {
          /* ignore */
        }
      }
    });
    row.addEventListener("dragend", () => {
      row.draggable = false;
      row.classList.remove("dragging");
      this._dragIndex = null;
      this._clearDropMarkers();
    });
    row.addEventListener("dragover", (ev) => {
      if (this._dragIndex == null || this._dragIndex === index) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      const rect = row.getBoundingClientRect();
      const after = ev.clientY > rect.top + rect.height / 2;
      this._clearDropMarkers();
      row.classList.add(after ? "drop-after" : "drop-before");
    });
    row.addEventListener("drop", (ev) => {
      if (this._dragIndex == null) return;
      ev.preventDefault();
      const rect = row.getBoundingClientRect();
      const after = ev.clientY > rect.top + rect.height / 2;
      this._dropReorder(this._dragIndex, index, after);
    });

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

  _clearDropMarkers() {
    if (!this._entitiesEl) return;
    for (const row of this._entitiesEl.children) {
      row.classList.remove("drop-before", "drop-after");
    }
  }

  // Move entity from `from` to drop near row `index` (after its midpoint or not).
  _dropReorder(from, index, after) {
    this._clearDropMarkers();
    let insertIndex = after ? index + 1 : index;
    if (from < insertIndex) insertIndex--;
    if (insertIndex === from) return;
    const entities = [...this._entities];
    const [moved] = entities.splice(from, 1);
    entities.splice(insertIndex, 0, moved);
    this._dragIndex = null;
    this._emit({ ...this._config, entities });
    this._renderEntities();
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
