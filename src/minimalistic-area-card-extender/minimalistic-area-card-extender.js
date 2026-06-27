/**
 * Minimalistic Area Card Extender — a `minimalistic-area-card-plus` that also
 * expands, in one self-contained card.
 *
 * It is sugar over the pack's own cards: the visible part is a full
 * `minimalistic-area-card-plus` (all its options: image/camera, entities,
 * templates, badges, icon sizes, active border, …) and, underneath, it reveals
 * child cards inline like `expander-card` (all its options: child-layout incl.
 * `grid`, gap, expanded, expand-on, group/accordion, border-color, …).
 *
 * Implementation: it builds an `expander-card` config whose `header` is a
 * `minimalistic-area-card-plus`, so every behaviour is the already-tested code
 * of those two cards — no duplication.
 *
 * Config = every minimalistic-area-card-plus option, PLUS the expander options
 * below (which are routed to the expander instead of the header):
 *   cards, child-layout, gap, expanded, columns, header-width, breakout,
 *   breakout-margin, breakout-max, group, border-color, drop, expand-on
 *
 * License: MIT
 */
const VERSION = typeof __PACK_VERSION__ !== "undefined" ? __PACK_VERSION__ : "dev";

const CARD_TYPE = "minimalistic-area-card-extender";
const EDITOR_TYPE = "minimalistic-area-card-extender-editor";
const HEADER_TYPE = "custom:minimalistic-area-card-plus";

// Options that belong to the expander wrapper; everything else is forwarded to
// the minimalistic header card.
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

function splitConfig(config) {
  const header = {};
  const exp = {};
  for (const k in config) {
    if (k === "type") continue;
    if (EXPANDER_KEYS.has(k)) exp[k] = config[k];
    else header[k] = config[k];
  }
  header.type = HEADER_TYPE;
  return {
    type: "custom:expander-card",
    "expand-on": "header",
    ...exp,
    header,
    cards: Array.isArray(config.cards) ? config.cards : [],
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
    this._inner = splitConfig(config);
    this._mount();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._el) this._el.hass = hass;
  }

  async _mount() {
    if (this._el) {
      this._el.setConfig(this._inner);
      if (this._hass) this._el.hass = this._hass;
      return;
    }
    if (this._mounting) {
      this._pending = true;
      return;
    }
    this._mounting = true;
    const helpers = await window.loadCardHelpers();
    this._el = helpers.createCardElement(this._inner);
    if (this._hass) this._el.hass = this._hass;
    this.shadowRoot.appendChild(this._el);
    this._mounting = false;
    if (this._pending) {
      this._pending = false;
      this._el.setConfig(this._inner);
      if (this._hass) this._el.hass = this._hass;
    }
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
// Editor — reuses the minimalistic editor for the visual part, adds the
// expander options and a stack-style content editor for the revealed cards.
// ---------------------------------------------------------------------------

const EXP_SCHEMA = [
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
              { value: "grid", label: "Grid (12-col, like HA sections)" },
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
const EXP_LABELS = {
  "child-layout": "Child layout",
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
    if (this._expForm) this._expForm.hass = hass;
    if (this._cardEd && "hass" in this._cardEd) this._cardEd.hass = hass;
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
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
    const out = { type: HEADER_TYPE };
    for (const k in this._config) {
      if (k === "type" || EXPANDER_KEYS.has(k)) continue;
      out[k] = this._config[k];
    }
    return out;
  }

  _expData() {
    return {
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
      if (this._expForm) this._expForm.data = this._expData();
      return;
    }
    this.innerHTML = "";
    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "16px";

    // 1) Visual part — the whole minimalistic-area-card-plus editor.
    const visual = document.createElement("minimalistic-area-card-plus-editor");
    visual.hass = this._hass;
    visual.setConfig(this._headerSubset());
    visual.addEventListener("config-changed", (ev) => {
      ev.stopPropagation();
      const v = { ...ev.detail.config };
      delete v.type;
      // Keep the expander options + cards; replace the visual ones.
      const keep = {};
      for (const k in this._config) {
        if (EXPANDER_KEYS.has(k)) keep[k] = this._config[k];
      }
      this._config = { ...v, ...keep };
      this._emit();
    });
    this._visualEd = visual;
    root.appendChild(visual);

    // 2) Expander options.
    root.appendChild(this._section("Expander", "How the revealed cards behave."));
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._expData();
    form.schema = EXP_SCHEMA;
    form.computeLabel = (s) => EXP_LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this._emit();
    });
    this._expForm = form;
    root.appendChild(form);

    // 3) Revealed content — edited like a stack.
    root.appendChild(
      this._section("Content (revealed)", "Edited like a stack — add cards, edit one at a time.")
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

    // YAML fallback.
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
      "A minimalistic-area-card-plus that expands inline to reveal child cards (all the expander options, in one card).",
    preview: false,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
  });
}

console.info(
  `%c MINIMALISTIC-AREA-CARD-EXTENDER %c v${VERSION} `,
  "color: white; background: #ff9800; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #ff9800; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
);
