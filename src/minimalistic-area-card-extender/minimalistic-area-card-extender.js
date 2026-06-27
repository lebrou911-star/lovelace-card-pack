/**
 * Minimalistic Area Card Extender — a `minimalistic-area-card-plus` wired to
 * open a separate `expander-child` by URL hash.
 *
 * It is the trigger half of the two-card pattern: give it a `hash` (e.g.
 * `#garage`) and it automatically (a) toggles that hash on tap, so the matching
 * `expander-child` reveals/collapses inline, and (b) shows an accent border
 * while that child is open. Everything else is a normal
 * `minimalistic-area-card-plus` (image/camera, entities, templates, badges,
 * icon sizes, …), so the visible card keeps all its styling.
 *
 * Pair it with an `expander-child` that has the same `hash`. The
 * `minimalistic-area-card-plus` card stays available unchanged for normal use.
 *
 * License: MIT
 */
const VERSION = typeof __PACK_VERSION__ !== "undefined" ? __PACK_VERSION__ : "dev";

const CARD_TYPE = "minimalistic-area-card-extender";
const EDITOR_TYPE = "minimalistic-area-card-extender-editor";
const HEADER_EL = "minimalistic-area-card-plus";

// Extender-only keys (everything else is forwarded to the minimalistic card).
const EXTENDER_KEYS = new Set(["hash"]);

function normHash(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

// Build the minimalistic-area-card-plus config: forward everything, and when a
// `hash` is set, wire the tap navigation + accent border to that child.
function buildHeaderConfig(config) {
  const out = { type: `custom:${HEADER_EL}` };
  for (const k in config) {
    if (k === "type" || EXTENDER_KEYS.has(k)) continue;
    out[k] = config[k];
  }
  const hash = normHash(config.hash);
  if (hash) {
    if (!out.tap_action) out.tap_action = { action: "navigate", navigation_path: hash };
    if (out.active_border === undefined) out.active_border = true;
    if (out.active_hash === undefined) out.active_hash = hash;
  }
  return out;
}

class MinimalisticAreaCardExtender extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig(hass) {
    const firstArea = hass && hass.areas ? hass.areas[Object.keys(hass.areas)[0]] : undefined;
    const config = {
      type: `custom:${CARD_TYPE}`,
      title: firstArea ? firstArea.name : "Living Room",
      entities: [],
      hash: "#popup",
    };
    if (firstArea) config.area = firstArea.area_id;
    return config;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    this._headerConfig = buildHeaderConfig(config);
    if (!this._el) {
      this._el = document.createElement(HEADER_EL);
      this.shadowRoot.appendChild(this._el);
    }
    this._el.setConfig(this._headerConfig);
    if (this._hass) this._el.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._el) this._el.hass = hass;
  }

  getCardSize() {
    return this._el && typeof this._el.getCardSize === "function" ? this._el.getCardSize() : 3;
  }

  getGridOptions() {
    return this._el && typeof this._el.getGridOptions === "function"
      ? this._el.getGridOptions()
      : undefined;
  }
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, MinimalisticAreaCardExtender);
}

// ---------------------------------------------------------------------------
// Editor — reuses the minimalistic editor for everything, adds a `hash` field.
// ---------------------------------------------------------------------------

const HASH_SCHEMA = [{ name: "hash", selector: { text: {} } }];
const HASH_LABELS = { hash: "Hash of the expander-child to open (e.g. #garage)" };

class MinimalisticAreaCardExtenderEditor extends HTMLElement {
  setConfig(config) {
    this._config = { hash: "#popup", ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._visualEd) this._visualEd.hass = hass;
    if (this._hashForm) this._hashForm.hass = hass;
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._visualEd && "lovelace" in this._visualEd) this._visualEd.lovelace = lovelace;
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _headerSubset() {
    const out = { type: `custom:${HEADER_EL}` };
    for (const k in this._config) {
      if (k === "type" || EXTENDER_KEYS.has(k)) continue;
      out[k] = this._config[k];
    }
    return out;
  }

  _section(title, description) {
    const el = document.createElement("div");
    const t = document.createElement("div");
    t.textContent = title;
    t.style.fontWeight = "600";
    t.style.margin = "4px 0";
    const d = document.createElement("div");
    d.textContent = description;
    d.style.fontSize = "0.85em";
    d.style.color = "var(--secondary-text-color)";
    d.style.marginBottom = "8px";
    el.appendChild(t);
    el.appendChild(d);
    return el;
  }

  _render() {
    if (!this._config) return;
    if (this._rendered) {
      if (this._visualEd) this._visualEd.setConfig(this._headerSubset());
      if (this._hashForm) this._hashForm.data = { hash: this._config.hash || "" };
      return;
    }
    this.innerHTML = "";
    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "16px";

    // Linked popup hash.
    root.appendChild(
      this._section("Linked popup", "The expander-child this card opens (same hash on both).")
    );
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = { hash: this._config.hash || "" };
    form.schema = HASH_SCHEMA;
    form.computeLabel = (s) => HASH_LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this._emit();
    });
    this._hashForm = form;
    root.appendChild(form);

    // Everything else — the full minimalistic editor.
    const visual = document.createElement(`${HEADER_EL}-editor`);
    visual.hass = this._hass;
    if (this._lovelace && "lovelace" in visual) visual.lovelace = this._lovelace;
    visual.setConfig(this._headerSubset());
    visual.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      const v = { ...ev.detail.config };
      delete v.type;
      const hash = this._config.hash;
      this._config = { ...v };
      if (hash !== undefined) this._config.hash = hash;
      this._emit();
    });
    this._visualEd = visual;
    root.appendChild(visual);

    this.appendChild(root);
    this._rendered = true;
  }
}

if (!customElements.get(EDITOR_TYPE)) {
  customElements.define(EDITOR_TYPE, MinimalisticAreaCardExtenderEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "Minimalistic Area Card Extender",
    description:
      "A minimalistic-area-card-plus that opens a separate expander-child by #hash (tap to toggle) and lights up while it's open.",
    preview: false,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
  });
}

console.info(
  `%c MINIMALISTIC-AREA-CARD-EXTENDER %c v${VERSION} `,
  "color: white; background: #ff9800; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #ff9800; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
);
