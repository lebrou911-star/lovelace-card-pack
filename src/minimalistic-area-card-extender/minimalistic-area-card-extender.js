/**
 * Minimalistic Area Card Extender — a `minimalistic-area-card-plus` with the
 * expander built in. It works in two modes, chosen by what you fill in:
 *
 *   • SELF-CONTAINED (set `cards:`) — the visible minimalistic card reveals
 *     those child cards INLINE right below itself (accordion), like the original
 *     expander. One card holds everything, so you place it anywhere and the
 *     content always opens directly under the header. Supports every expander
 *     option (child-layout incl. `grid`, gap, expanded, expand-on, group,
 *     border-color, …). Implemented by wrapping `expander-card` with a
 *     minimalistic header — no duplicated logic.
 *
 *   • TRIGGER (set `hash:`, no `cards`) — the card opens a SEPARATE
 *     `expander-child` that has the same hash: tap toggles the hash, and the
 *     card lights up (accent border) while that child is open.
 *
 * Either way the visible part keeps all minimalistic-area-card-plus options.
 * The `minimalistic-area-card-plus` card stays available unchanged.
 *
 * License: MIT
 */
const VERSION = typeof __PACK_VERSION__ !== "undefined" ? __PACK_VERSION__ : "dev";

const CARD_TYPE = "minimalistic-area-card-extender";
const EDITOR_TYPE = "minimalistic-area-card-extender-editor";
const HEADER_EL = "minimalistic-area-card-plus";

// Options routed to the expander wrapper (self-contained mode); everything else
// goes to the minimalistic header card.
const EXPANDER_KEYS = new Set([
  "cards",
  "child-layout",
  "gap",
  "expanded",
  "columns",
  "header-width",
  "breakout",
  "breakout-margin",
  "breakout-max",
  "group",
  "border-color",
  "drop",
  "expand-on",
]);
// Extender-only keys (never forwarded as-is to the header).
const EXTENDER_KEYS = new Set(["hash"]);

function normHash(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

function isSelfContained(config) {
  return Array.isArray(config.cards) && config.cards.length > 0;
}

// Minimalistic header config: forward everything except expander/extender keys.
// With a `hash` (trigger mode), wire tap navigation + accent border to it.
function buildHeaderConfig(config, { wireHash }) {
  const out = { type: `custom:${HEADER_EL}` };
  for (const k in config) {
    if (k === "type" || EXPANDER_KEYS.has(k) || EXTENDER_KEYS.has(k)) continue;
    out[k] = config[k];
  }
  const hash = normHash(config.hash);
  if (wireHash && hash) {
    if (!out.tap_action) out.tap_action = { action: "navigate", navigation_path: hash };
    if (out.active_border === undefined) out.active_border = true;
    if (out.active_hash === undefined) out.active_hash = hash;
  }
  return out;
}

// Self-contained: an expander-card whose header is the minimalistic card.
function buildExpanderConfig(config) {
  const exp = {};
  for (const k in config) {
    if (EXPANDER_KEYS.has(k) && k !== "cards") exp[k] = config[k];
  }
  return {
    type: "custom:expander-card",
    "expand-on": "header",
    ...exp,
    header: buildHeaderConfig(config, { wireHash: false }),
    cards: config.cards,
  };
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
      cards: [],
      "child-layout": "vertical",
    };
    if (firstArea) config.area = firstArea.area_id;
    return config;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    const selfContained = isSelfContained(config);
    this._tag = selfContained ? "expander-card" : HEADER_EL;
    this._inner = selfContained
      ? buildExpanderConfig(config)
      : buildHeaderConfig(config, { wireHash: true });
    this._mount();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._el) this._el.hass = hass;
  }

  _mount() {
    if (this._el && this._elTag !== this._tag) {
      this._el.remove();
      this._el = null;
    }
    if (!this._el) {
      this._el = document.createElement(this._tag);
      this._elTag = this._tag;
      this.shadowRoot.appendChild(this._el);
    }
    this._el.setConfig(this._inner);
    if (this._hass) this._el.hass = this._hass;
  }

  getCardSize() {
    return this._el && typeof this._el.getCardSize === "function" ? this._el.getCardSize() : 3;
  }

  // No getGridOptions() — identical to expander-card. In a Sections view HA
  // provides the Layout tab and honours `grid_options.columns` natively; in a
  // masonry view there are simply no columns (full width), as for any card.
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, MinimalisticAreaCardExtender);
}

// ---------------------------------------------------------------------------
// Editor — minimalistic editor for the visuals + extender/expander options +
// a stack-style editor for the revealed cards.
// ---------------------------------------------------------------------------

const OPT_SCHEMA = [
  { name: "hash", selector: { text: {} } },
  {
    type: "grid",
    schema: [
      {
        name: "child-layout",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "vertical", label: "Vertical" },
              { value: "horizontal", label: "Horizontal" },
              { value: "grid", label: "Grid (12-col)" },
            ],
          },
        },
      },
      { name: "gap", selector: { number: { min: 0, max: 48, mode: "box", unit_of_measurement: "px" } } },
    ],
  },
  {
    type: "grid",
    schema: [
      {
        name: "expand-on",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "header", label: "Tap the card" },
              { value: "chevron", label: "Chevron only" },
              { value: "both", label: "Card + chevron" },
            ],
          },
        },
      },
      { name: "expanded", selector: { boolean: {} } },
    ],
  },
];
const OPT_LABELS = {
  hash: "Hash to open a SEPARATE expander-child (leave empty if using Content below)",
  "child-layout": "Child layout (self-contained)",
  gap: "Gap between children",
  "expand-on": "Expand on",
  expanded: "Expanded by default",
};

class MinimalisticAreaCardExtenderEditor extends HTMLElement {
  setConfig(config) {
    this._config = { "child-layout": "vertical", gap: 8, "expand-on": "header", ...config };
    this._render();
    this._ensureNativeEditors();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._visualEd) this._visualEd.hass = hass;
    if (this._optForm) this._optForm.hass = hass;
    if (this._cardEd && "hass" in this._cardEd) this._cardEd.hass = hass;
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._visualEd && "lovelace" in this._visualEd) this._visualEd.lovelace = lovelace;
    if (this._cardEd && "lovelace" in this._cardEd) this._cardEd.lovelace = lovelace;
  }

  get _hasNativeEditor() {
    return !!customElements.get("hui-card-element-editor");
  }

  async _ensureNativeEditors() {
    const need = ["hui-card-element-editor", "hui-card-picker"];
    if (need.every((n) => customElements.get(n))) return;
    try {
      const helpers = await window.loadCardHelpers();
      const stack = helpers.createCardElement({ type: "vertical-stack", cards: [] });
      const ctor = stack && stack.constructor;
      if (ctor && ctor.getConfigElement) await ctor.getConfigElement();
    } catch (e) {
      /* keep YAML fallback */
    }
    await Promise.race([
      Promise.all(need.map((n) => customElements.whenDefined(n))),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    if (this._hasNativeEditor && !this._upgraded) {
      this._upgraded = true;
      this._rendered = false;
      this._render();
    }
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
      if (k === "type" || EXPANDER_KEYS.has(k) || EXTENDER_KEYS.has(k)) continue;
      out[k] = this._config[k];
    }
    return out;
  }

  _optData() {
    return {
      hash: this._config.hash || "",
      "child-layout": this._config["child-layout"] || "vertical",
      gap: Number(this._config.gap) || 0,
      "expand-on": this._config["expand-on"] || "header",
      expanded: !!this._config.expanded,
    };
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
      if (this._optForm) this._optForm.data = this._optData();
      return;
    }
    this.innerHTML = "";
    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "16px";

    // Visual part — the whole minimalistic editor.
    const visual = document.createElement(`${HEADER_EL}-editor`);
    visual.hass = this._hass;
    if (this._lovelace && "lovelace" in visual) visual.lovelace = this._lovelace;
    visual.setConfig(this._headerSubset());
    visual.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      const v = { ...ev.detail.config };
      delete v.type; // drop the inner minimalistic header type
      // Preserve the EXTENDER's own type + its expander/extender-only keys,
      // otherwise the emitted config loses `type` ("No type provided").
      const keep = { type: this._config.type || `custom:${CARD_TYPE}` };
      for (const k in this._config) {
        if (EXPANDER_KEYS.has(k) || EXTENDER_KEYS.has(k)) keep[k] = this._config[k];
      }
      this._config = { ...v, ...keep };
      this._emit();
    });
    this._visualEd = visual;
    root.appendChild(visual);

    // Extender / expander options.
    root.appendChild(
      this._section(
        "Expander",
        "Fill Content below for an inline self-contained card, OR set a hash to open a separate expander-child."
      )
    );
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._optData();
    form.schema = OPT_SCHEMA;
    form.computeLabel = (s) => OPT_LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this._emit();
    });
    this._optForm = form;
    root.appendChild(form);

    // Revealed content (self-contained) — edited like a stack.
    root.appendChild(
      this._section("Content (revealed inline)", "Edited like a stack. Leave empty to use the hash trigger instead.")
    );
    this._cardContainer = document.createElement("div");
    root.appendChild(this._cardContainer);
    this._renderCardEditor();

    this.appendChild(root);
    this._rendered = true;
  }

  _renderCardEditor() {
    const c = this._cardContainer;
    c.innerHTML = "";
    const cards = Array.isArray(this._config.cards) ? this._config.cards : [];

    if (this._hasNativeEditor) {
      const ed = document.createElement("hui-card-element-editor");
      ed.hass = this._hass;
      ed.lovelace = this._lovelace;
      ed.value = { type: "vertical-stack", cards };
      ed.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const v = ev.detail.config || {};
        this._config = { ...this._config, cards: Array.isArray(v.cards) ? v.cards : [] };
        this._emit();
      });
      this._cardEd = ed;
      c.appendChild(ed);
      return;
    }

    const ta = document.createElement("textarea");
    ta.value = JSON.stringify(cards, null, 2);
    ta.style.width = "100%";
    ta.style.minHeight = "140px";
    ta.style.fontFamily = "var(--code-font-family, monospace)";
    ta.style.boxSizing = "border-box";
    ta.addEventListener("input", () => {
      try {
        const v = JSON.parse(ta.value);
        this._config = { ...this._config, cards: Array.isArray(v) ? v : [] };
        this._emit();
      } catch (e) {
        /* wait for valid JSON */
      }
    });
    this._cardEd = ta;
    c.appendChild(ta);
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
      "A minimalistic-area-card-plus with a built-in expander: reveal child cards inline (self-contained), or open a separate expander-child by #hash.",
    preview: false,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
  });
}

console.info(
  `%c MINIMALISTIC-AREA-CARD-EXTENDER %c v${VERSION} `,
  "color: white; background: #ff9800; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #ff9800; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
);
