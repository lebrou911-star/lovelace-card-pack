/**
 * Expander Card — header card that slides open to reveal child cards.
 *
 * Part of lovelace-card-pack. Registers the <expander-card> element and its
 * visual editor <expander-card-editor>. Self-contained vanilla JS module
 * imported for its side effects by src/index.js.
 *
 * License: MIT
 */
const VERSION = "0.23.0";

// Resolve a header-width value into a CSS max-width.
// 1..12 -> fraction of 12 columns; a bare number -> px; a CSS string used as-is.
function resolveHeaderWidth(v) {
  if (v == null || v === "" || v === 0 || v === "0") return null;
  if (typeof v === "number") {
    if (v >= 1 && v <= 12) return `calc(${v} / 12 * 100%)`;
    return `${v}px`;
  }
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n >= 1 && n <= 12) return `calc(${n} / 12 * 100%)`;
    return `${n}px`;
  }
  return s;
}

class ExpanderCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._expanded = false;
    this._headerEl = null;
    this._childEls = [];
    this._built = false;
    this._onResize = () => this._applyBreakout();
    // Accordion: close this card when another card in the same group opens.
    this._onGroupOpen = (ev) => {
      const group = this._config && this._config.group;
      if (!group || !ev.detail) return;
      if (ev.detail.group !== group || ev.detail.source === this) return;
      if (this._expanded) this._setExpanded(false);
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = {
      "expand-on": "both",
      expanded: false,
      gap: 8,
      "child-layout": "vertical",
      columns: 0,
      "header-width": 0,
      breakout: false,
      "breakout-margin": 8,
      "breakout-max": 0,
      group: "",
      "border-color": "",
      drop: 0,
      ...config,
    };
    if (!Array.isArray(this._config.cards)) this._config.cards = [];
    this._expanded = !!this._config.expanded;
    this._built = false;
    if (this.shadowRoot) this._build();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._headerEl) this._headerEl.hass = hass;
    this._childEls.forEach((el) => (el.hass = hass));
  }

  getCardSize() {
    let size = 1;
    if (this._expanded) {
      this._childEls.forEach((el) => {
        size += typeof el.getCardSize === "function" ? el.getCardSize() : 1;
      });
    }
    return size;
  }

  async _createCardElement(cardConfig) {
    const helpers = await window.loadCardHelpers();
    const el = helpers.createCardElement(cardConfig);
    if (this._hass) el.hass = this._hass;
    el.addEventListener(
      "ll-rebuild",
      (ev) => {
        ev.stopPropagation();
        this._rebuildCard(el, cardConfig);
      },
      { once: true }
    );
    return el;
  }

  async _rebuildCard(oldEl, cardConfig) {
    const newEl = await this._createCardElement(cardConfig);
    if (oldEl.parentElement) oldEl.parentElement.replaceChild(newEl, oldEl);
    return newEl;
  }

  // Place a child in the 12-col native grid using its grid_options.columns
  // (mirrors how a HA section spans cards). Unknown/zero -> full width.
  _applyGridSpan(el, childConfig) {
    let cols = childConfig && childConfig.grid_options ? childConfig.grid_options.columns : undefined;
    if (cols == null && typeof el.getGridOptions === "function") {
      try {
        cols = (el.getGridOptions() || {}).columns;
      } catch (e) {}
    }
    if (cols === "full" || cols == null) {
      el.style.gridColumn = "1 / -1";
      return;
    }
    const n = parseInt(cols, 10);
    el.style.gridColumn = Number.isFinite(n) ? `span ${Math.max(1, Math.min(12, n))}` : "1 / -1";
  }

  async _build() {
    if (this._built) return;
    this._built = true;
    const gap = Number(this._config.gap) || 0;
    const expandOn = this._config["expand-on"];
    const showChevron = expandOn === "chevron" || expandOn === "both";

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .wrapper { position: relative; }
      .header-row { position: relative; }
      .header-card { position: relative; width: 100%; border-radius: var(--ha-card-border-radius, 12px); transition: box-shadow 0.25s ease; }
      /* The chevron sits on top of the header card (absolute), so the header
         card keeps the exact same size as any other card. */
      .chevron {
        position: absolute; right: 8px; top: 0; bottom: 0; z-index: 1;
        display: flex; align-items: center; justify-content: center;
        width: 36px; cursor: pointer; color: var(--secondary-text-color);
        transition: transform 0.3s ease;
      }
      .chevron.open { transform: rotate(180deg); }
      .chevron:hover { color: var(--primary-text-color); }
      .header-clickable { cursor: pointer; }
      .header-tap-overlay { position: absolute; inset: 0; z-index: 3; cursor: pointer; }
      .children {
        display: grid; grid-template-rows: 0fr;
        transition: grid-template-rows 0.3s ease; overflow: hidden;
      }
      .children.open { grid-template-rows: 1fr; }
      .children-inner {
        min-height: 0; overflow: hidden; display: flex; flex-direction: column;
        gap: ${gap}px;
      }
      /* Top spacing only when open, so the collapsed area is truly 0px
         (a padding-top here would keep the inner from shrinking to zero and
         add an extra gap under the collapsed card). */
      .children.open .children-inner { padding-top: ${gap}px; }
      .children-inner.horizontal { flex-direction: row; flex-wrap: wrap; align-items: stretch; }
      .children-inner.horizontal > * { flex: 1 1 0; min-width: 0; }
      .children-inner.grid { display: grid; }
      .children-inner.grid > * { min-width: 0; }
      @supports not (grid-template-rows: 1fr) {
        .children { display: block; max-height: 0; transition: max-height 0.3s ease; }
        .children.open { max-height: 1500px; }
      }
    `;

    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";
    const headerRow = document.createElement("div");
    headerRow.className = "header-row";

    const headerConfig = this._config.header;
    this._headerEl =
      headerConfig && headerConfig.type
        ? await this._createCardElement(headerConfig)
        : null;
    const headerHolder = document.createElement("div");
    headerHolder.className = "header-card";
    this._headerHolderEl = headerHolder;
    const headerWidth = resolveHeaderWidth(this._config["header-width"]);
    if (headerWidth) headerHolder.style.maxWidth = headerWidth;
    // Behaviour (automatic, no option):
    // - "header" (no chevron): a transparent overlay swallows taps and toggles,
    //   so the header card (and e.g. a Mushroom icon "disk") stays visible but
    //   its own tap/icon actions never fire.
    // - "both": the header also toggles, via a non-blocking handler that still
    //   lets genuinely interactive controls work; the chevron toggles too.
    // - "chevron": the header is left fully normal; only the chevron toggles.
    const useOverlay = expandOn === "header";
    if (expandOn === "both") {
      headerHolder.classList.add("header-clickable");
      headerHolder.addEventListener("click", (ev) => {
        const path = ev.composedPath();
        const interactive = path.some(
          (n) =>
            n.nodeName &&
            /^(HA-SWITCH|HA-SLIDER|INPUT|SELECT|MWC-|HA-ICON-BUTTON)/.test(n.nodeName)
        );
        if (interactive) return;
        this._toggle();
      });
    }
    if (this._headerEl) {
      headerHolder.appendChild(this._headerEl);
    } else {
      const ph = document.createElement("div");
      ph.textContent = "Select a header card";
      ph.style.cssText = "padding: 16px; opacity: 0.6;";
      headerHolder.appendChild(ph);
    }

    if (showChevron) {
      const chevron = document.createElement("div");
      chevron.className = "chevron" + (this._expanded ? " open" : "");
      chevron.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon>`;
      chevron.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._toggle();
      });
      this._chevronEl = chevron;
      // Inside the header holder so it stays at the header's right edge even
      // when the header is narrower than the full card width.
      headerHolder.appendChild(chevron);
    }

    if (useOverlay) {
      // Transparent layer on top of the header that swallows the tap and
      // toggles. The header card stays visible (so its icon "disk" shows) but
      // never receives pointer events, so its own tap/icon actions don't fire.
      headerHolder.classList.add("header-clickable");
      const overlay = document.createElement("div");
      overlay.className = "header-tap-overlay";
      overlay.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._toggle();
      });
      headerHolder.appendChild(overlay);
    }
    headerRow.appendChild(headerHolder);
    wrapper.appendChild(headerRow);

    const children = document.createElement("div");
    children.className = "children" + (this._expanded ? " open" : "");
    const horizontal = this._config["child-layout"] === "horizontal";
    const nativeGrid = this._config["child-layout"] === "grid";
    const columns = parseInt(this._config.columns, 10) || 0;
    const inner = document.createElement("div");
    inner.className = "children-inner";
    if (nativeGrid) {
      // Native HA section layout: a 12-column grid where each child spans its
      // grid_options.columns (mirrors a HA section / Bubble Card pop-up).
      inner.classList.add("grid");
      inner.style.gridTemplateColumns = "repeat(12, minmax(0, 1fr))";
    } else if (columns >= 1) {
      // Explicit column count wins: arrange children in an N-column grid.
      inner.classList.add("grid");
      inner.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    } else if (horizontal) {
      inner.classList.add("horizontal");
    }
    this._childEls = [];
    for (const childConfig of this._config.cards) {
      const el = await this._createCardElement(childConfig);
      if (nativeGrid) this._applyGridSpan(el, childConfig);
      this._childEls.push(el);
      inner.appendChild(el);
    }
    children.appendChild(inner);
    wrapper.appendChild(children);
    this._childrenEl = children;

    this.shadowRoot.innerHTML = "";
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrapper);
    requestAnimationFrame(() => this._applyBreakout());
    this._applyHeaderBorder();
  }

  // Outline the header with `border-color` while the card is expanded.
  _applyHeaderBorder() {
    if (!this._headerHolderEl) return;
    const col = this._config && this._config["border-color"];
    this._headerHolderEl.style.boxShadow =
      this._expanded && col ? `0 0 0 2px ${col}` : "";
  }

  // Walk up the (shadow-piercing) ancestor chain.
  _climb(visit) {
    const cParent = (n) => {
      if (n.assignedSlot) return n.assignedSlot;
      const p = n.parentNode;
      if (!p) return null;
      if (p.nodeType === 11) return p.host || null; // ShadowRoot
      return p;
    };
    let node = this;
    let guard = 0;
    while (node && guard++ < 60) {
      const out = visit(node);
      if (out) return out;
      node = cParent(node);
    }
    return null;
  }

  // Find the content column the card sits in (the section / view container), so
  // breakout can match it — full width on mobile, the centered column on desktop.
  // Returns null on layouts we don't recognise (e.g. layout-card), so breakout
  // falls back to the viewport (or the popup, when inside one).
  _contentRect() {
    try {
      return this._climb((node) => {
        const tag = node.tagName;
        if (tag === "HUI-SECTION") {
          const inner = node.shadowRoot && node.shadowRoot.querySelector(".container");
          return (inner || node).getBoundingClientRect();
        }
        if (tag === "HUI-MASONRY-VIEW" || tag === "HUI-VIEW" || tag === "HUI-PANEL-VIEW") {
          return node.getBoundingClientRect();
        }
        return null;
      });
    } catch (e) {
      return null;
    }
  }

  // If the card lives inside a popup/dialog, return that popup's content rect so
  // breakout fills the popup instead of the whole browser viewport (which would
  // push the children off-screen). Returns null on a normal dashboard, so the
  // viewport fallback (the long-standing breakout behaviour) is preserved there.
  _popupRect() {
    try {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      return this._climb((node) => {
        if (node === this || node.nodeType !== 1) return null;
        const tag = node.tagName;
        // more-info / browser_mod dialogs.
        if (tag === "HA-DIALOG") {
          const surface = node.shadowRoot && node.shadowRoot.querySelector(".mdc-dialog__surface");
          const r = (surface || node).getBoundingClientRect();
          if (r && r.width && r.width < vw) return r;
        }
        // Bubble Card pop-up.
        if (node.classList && (node.classList.contains("bubble-pop-up") || node.classList.contains("bubble-pop-up-container"))) {
          const r = node.getBoundingClientRect();
          if (r && r.width && r.width < vw) return r;
        }
        // Generic dialog role.
        if (node.getAttribute && node.getAttribute("role") === "dialog") {
          const r = node.getBoundingClientRect();
          if (r && r.width && r.width < vw) return r;
        }
        return null;
      });
    } catch (e) {
      return null;
    }
  }

  // Let the expanded children break out of the card's grid cell. They match the
  // content column width by default (full width on mobile, the centered column on
  // desktop); `breakout-max` optionally caps it further.
  _applyBreakout() {
    const el = this._childrenEl;
    if (!el) return;
    // Reset
    el.style.width = "";
    el.style.marginLeft = "";
    el.style.position = "";
    el.style.zIndex = "";
    el.style.top = "";
    el.style.left = "";

    const breakout = !!(this._config && this._config.breakout);
    const drop = Number(this._config && this._config.drop) || 0;
    if (!breakout && drop <= 0) return;

    const rect = this.getBoundingClientRect();
    if (!rect.width) return;

    // Compute target width + viewport-left.
    let width, leftViewport;
    if (breakout) {
      const margin = Number(this._config["breakout-margin"]) || 0;
      const cr = this._contentRect();
      if (cr && cr.width) {
        // Match the content column (aligns with the other cards).
        width = cr.width;
        leftViewport = cr.left;
      } else {
        const pr = this._popupRect();
        if (pr && pr.width) {
          // Inside a popup/dialog: fill the popup, not the whole browser
          // viewport (which would push the children off-screen on desktop).
          width = pr.width - margin * 2;
          leftViewport = pr.left + margin;
        } else {
          // Normal dashboard with a layout we don't recognise (e.g. layout-card):
          // break out to the viewport, the long-standing behaviour.
          const vw = document.documentElement.clientWidth || window.innerWidth;
          width = vw - margin * 2;
          leftViewport = (vw - width) / 2;
        }
      }
      const maxW = Number(this._config["breakout-max"]) || 0;
      if (maxW > 0 && maxW < width) {
        leftViewport += (width - maxW) / 2; // keep centered within the column
        width = maxW;
      }
    } else {
      width = rect.width; // drop only: keep the card width
      leftViewport = rect.left;
    }

    if (drop > 0) {
      // Float the panel `drop` px below the header so cards next to / below the
      // header stay in place (the panel overlays the area below).
      el.style.position = "absolute";
      el.style.top = `calc(100% + ${drop}px)`;
      el.style.zIndex = "6";
      el.style.left = `${leftViewport - rect.left}px`;
      el.style.width = `${width}px`;
      return;
    }

    // In-flow: push content below; lift above neighbours so taps reach children.
    el.style.width = `${width}px`;
    el.style.marginLeft = `${leftViewport - rect.left}px`;
    el.style.position = "relative";
    el.style.zIndex = "6";
  }

  _setExpanded(state) {
    this._expanded = state;
    if (this._childrenEl) this._childrenEl.classList.toggle("open", state);
    if (this._chevronEl) this._chevronEl.classList.toggle("open", state);
    this._applyHeaderBorder();
    requestAnimationFrame(() => this._applyBreakout());
    this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
  }

  _toggle() {
    this._setExpanded(!this._expanded);
    if (this._expanded && this._config.group) {
      // Tell other cards in the same group to close (accordion).
      window.dispatchEvent(
        new CustomEvent("expander-card:opened", {
          detail: { group: this._config.group, source: this },
        })
      );
    }
  }

  connectedCallback() {
    if (!this._built && this._config) this._build();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("expander-card:opened", this._onGroupOpen);
    requestAnimationFrame(() => this._applyBreakout());
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("expander-card:opened", this._onGroupOpen);
  }

  static getConfigElement() {
    return document.createElement("expander-card-editor");
  }

  static getStubConfig() {
    // Start blank: pick the header card and add child cards from scratch.
    return {
      "expand-on": "both",
      expanded: false,
      header: {},
      cards: [],
    };
  }
}

// Guard the registration: if another resource (e.g. the old standalone
// Expander Card) already defined this element, defining it again throws and
// would abort the rest of the pack bundle. Warn instead so the other cards in
// the pack still register.
if (customElements.get("expander-card")) {
  console.warn(
    "[lovelace-card-pack] 'expander-card' is already registered by another resource. " +
      "Remove the standalone Expander Card HACS resource to use the one bundled in the pack."
  );
} else {
  customElements.define("expander-card", ExpanderCard);
}

/* ------------------------------------------------------------------ *
 * Visual editor (Home Assistant GUI)
 * ------------------------------------------------------------------ */

const EDITOR_SCHEMA = [
  {
    name: "expand-on",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "header", label: "Header only — tap the card, no chevron" },
          { value: "chevron", label: "Chevron only — tap the arrow" },
          { value: "both", label: "Both (header + chevron)" },
        ],
      },
    },
  },
  { name: "columns", selector: { number: { min: 0, max: 12, mode: "box" } } },
  { name: "header-width", selector: { number: { min: 0, max: 12, mode: "box" } } },
  { name: "gap", selector: { number: { min: 0, max: 64, mode: "box", unit_of_measurement: "px" } } },
  { name: "breakout", selector: { boolean: {} } },
  { name: "breakout-margin", selector: { number: { min: 0, max: 64, mode: "box", unit_of_measurement: "px" } } },
  { name: "breakout-max", selector: { number: { min: 0, max: 2000, mode: "box", unit_of_measurement: "px" } } },
  { name: "drop", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "px" } } },
  { name: "group", selector: { text: {} } },
  { name: "border-color", selector: { text: {} } },
  { name: "expanded", selector: { boolean: {} } },
];

const EDITOR_LABELS = {
  "expand-on": "Expand on",
  columns: "Columns (0 = auto)",
  "header-width": "Header width (cols, 0 = full)",
  gap: "Gap between child cards",
  breakout: "Full-width children (break out of the card)",
  "breakout-margin": "Break-out side margin",
  "breakout-max": "Break-out max width (px, 0 = full; centered — use on desktop)",
  drop: "Drop the panel down (px, floats; keeps cards above in place)",
  group: "Accordion group (same name = only one open at a time)",
  "border-color": "Header border color when expanded (e.g. red, #ff9800)",
  expanded: "Start expanded",
};

const MDI_DELETE =
  "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";
const MDI_ARROW_LEFT =
  "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z";
const MDI_ARROW_UP = "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z";
const MDI_ARROW_DOWN = "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z";
const MDI_PENCIL =
  "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z";
const MDI_CODE_BRACES =
  "M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11H3V13H4A2,2 0 0,1 6,15V19A2,2 0 0,0 8,21H10V19H8V14A2,2 0 0,0 6,12A2,2 0 0,0 8,10V5H10V3M16,3A2,2 0 0,1 18,5V9A2,2 0 0,0 20,11H21V13H20A2,2 0 0,1 18,15V19A2,2 0 0,1 16,21H14V19H16V14A2,2 0 0,1 18,12A2,2 0 0,1 16,10V5H14V3H16Z";

class ExpanderCardEditor extends HTMLElement {
  constructor() {
    super();
    this._listEds = [];
  }

  setConfig(config) {
    this._config = {
      "expand-on": "both",
      expanded: false,
      gap: 8,
      "child-layout": "vertical",
      ...config,
    };
    this._render();
    this._ensureNativeEditors();
  }

  // The hui-card-element-editor / hui-card-picker elements are lazy-loaded by
  // HA. Force their import (via a built-in stack's editor) so the children get a
  // real stack-like GUI (add / remove / pick type) instead of the YAML fallback.
  async _ensureNativeEditors() {
    const need = ["hui-stack-card-editor", "hui-card-element-editor", "hui-card-picker"];
    if (need.every((n) => customElements.get(n))) return;
    try {
      const helpers = await window.loadCardHelpers();
      const stack = helpers.createCardElement({ type: "vertical-stack", cards: [] });
      const ctor = stack && stack.constructor;
      if (ctor && ctor.getConfigElement) await ctor.getConfigElement();
    } catch (e) {
      /* ignore — we keep the YAML fallback */
    }
    await Promise.race([
      Promise.all(need.map((n) => customElements.whenDefined(n))),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    const ready =
      customElements.get("hui-stack-card-editor") ||
      customElements.get("hui-card-element-editor");
    if (ready && !this._upgraded) {
      this._upgraded = true;
      this._rendered = false;
      this._render(); // re-render now that native editors exist
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    this._propagate("hass", hass);
  }

  // HA only sets `lovelace` on the config element when the property exists,
  // so defining this setter is what makes nested GUI card editors work.
  set lovelace(lovelace) {
    this._lovelace = lovelace;
    this._propagate("lovelace", lovelace);
  }

  _propagate(prop, value) {
    [this._headerEd, this._picker, this._stackEd, ...(this._listEds || [])].forEach((el) => {
      if (el && prop in el) el[prop] = value;
    });
  }

  get _hasNativeEditor() {
    return !!customElements.get("hui-card-element-editor");
  }

  _formData() {
    return {
      "expand-on": this._config["expand-on"],
      columns: Number(this._config.columns) || 0,
      "header-width": Number(this._config["header-width"]) || 0,
      gap: Number(this._config.gap) || 0,
      breakout: !!this._config.breakout,
      "breakout-margin": Number(this._config["breakout-margin"]) || 0,
      "breakout-max": Number(this._config["breakout-max"]) || 0,
      drop: Number(this._config.drop) || 0,
      group: this._config.group || "",
      "border-color": this._config["border-color"] || "",
      expanded: !!this._config.expanded,
    };
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

  _section(title, description) {
    const el = document.createElement("div");
    const t = document.createElement("div");
    t.textContent = title;
    t.style.fontWeight = "600";
    t.style.marginBottom = "4px";
    const d = document.createElement("div");
    d.textContent = description;
    d.style.fontSize = "0.85em";
    d.style.color = "var(--secondary-text-color)";
    d.style.marginBottom = "8px";
    el.appendChild(t);
    el.appendChild(d);
    return el;
  }

  _iconButton(path, label, disabled, onClick) {
    const b = document.createElement("ha-icon-button");
    b.path = path;
    b.label = label;
    b.disabled = !!disabled;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!disabled) onClick();
    });
    return b;
  }

  // Full GUI editor for a single card config (with built-in GUI/YAML toggle),
  // falling back to a YAML/JSON editor on older HA versions.
  _makeCardEditor(value, onChange) {
    if (this._hasNativeEditor) {
      const ed = document.createElement("hui-card-element-editor");
      ed.hass = this._hass;
      ed.lovelace = this._lovelace;
      ed.value = value;
      ed.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        onChange(ev.detail.config);
      });
      return ed;
    }
    return this._makeObjectEditor(value, onChange);
  }

  // Object/array editor: prefer HA's native ha-yaml-editor, fall back to a JSON textarea.
  _makeObjectEditor(value, onChange) {
    if (customElements.get("ha-yaml-editor")) {
      const ed = document.createElement("ha-yaml-editor");
      ed.hass = this._hass;
      ed.defaultValue = value;
      ed.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        if (ev.detail.isValid === false) return;
        onChange(ev.detail.value);
      });
      return ed;
    }
    const ta = document.createElement("textarea");
    ta.value = JSON.stringify(value, null, 2);
    ta.style.width = "100%";
    ta.style.minHeight = "140px";
    ta.style.fontFamily = "var(--code-font-family, monospace)";
    ta.style.boxSizing = "border-box";
    ta.addEventListener("input", () => {
      try {
        onChange(JSON.parse(ta.value));
      } catch (e) {
        /* ignore until valid JSON */
      }
    });
    return ta;
  }

  _render() {
    if (!this._config) return;
    if (this._rendered) {
      if (this._form) this._form.data = this._formData();
      return;
    }

    this.innerHTML = "";
    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "16px";

    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._formData();
    form.schema = EDITOR_SCHEMA;
    form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this._emit();
    });
    this._form = form;
    root.appendChild(form);

    root.appendChild(
      this._section("Header card", "Pick a card, then edit it — the always-visible part.")
    );
    this._headerContainer = document.createElement("div");
    root.appendChild(this._headerContainer);
    this._renderHeaderEditor();

    root.appendChild(
      this._section("Child cards", "Cards revealed when the header is expanded.")
    );
    this._cardsContainer = document.createElement("div");
    this._cardsContainer.style.display = "flex";
    this._cardsContainer.style.flexDirection = "column";
    this._cardsContainer.style.gap = "12px";
    root.appendChild(this._cardsContainer);
    this._renderCardsList();

    this.appendChild(root);
    this._rendered = true;
  }

  _renderHeaderEditor() {
    const c = this._headerContainer;
    c.innerHTML = "";
    const h = this._config.header;
    const hasCard = !!(h && h.type);

    // Toolbar: YAML toggle (always) + delete (when a card is set).
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.justifyContent = "flex-end";
    bar.style.gap = "4px";
    bar.appendChild(
      this._iconButton(
        MDI_CODE_BRACES,
        this._headerYaml ? "Edit in the visual editor" : "Edit in YAML",
        false,
        () => {
          this._headerYaml = !this._headerYaml;
          this._renderHeaderEditor();
        }
      )
    );
    if (hasCard) {
      bar.appendChild(
        this._iconButton(MDI_DELETE, "Remove header card", false, () => {
          this._config = { ...this._config, header: {} };
          this._emit();
          this._headerYaml = false;
          this._renderHeaderEditor();
        })
      );
    }
    c.appendChild(bar);

    // YAML mode: edit the header config directly (works even when empty).
    if (this._headerYaml) {
      this._headerEd = this._makeObjectEditor(this._config.header || {}, (v) => {
        this._config = { ...this._config, header: v };
        this._emit();
      });
      c.appendChild(this._headerEd);
      return;
    }

    if (hasCard) {
      this._headerEd = this._makeCardEditor(h, (v) => {
        this._config = { ...this._config, header: v };
        this._emit();
      });
      c.appendChild(this._headerEd);
    } else if (customElements.get("hui-card-picker")) {
      // No header yet: show the card picker, just like adding a child.
      const picker = document.createElement("hui-card-picker");
      picker.hass = this._hass;
      picker.lovelace = this._lovelace;
      picker.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        this._config = { ...this._config, header: ev.detail.config };
        this._emit();
        this._renderHeaderEditor();
      });
      this._headerEd = picker;
      c.appendChild(picker);
    } else {
      this._headerEd = this._makeObjectEditor(this._config.header || {}, (v) => {
        this._config = { ...this._config, header: v };
        this._emit();
      });
      c.appendChild(this._headerEd);
    }
  }

  _renderCardsList() {
    const cards = Array.isArray(this._config.cards) ? this._config.cards : [];
    this._listEds = [];
    this._stackEd = null;
    this._cardsContainer.innerHTML = "";

    // Bubble Card style editing: two screens, navigated (never two editors
    // mounted at once). The LIST screen shows one light row per child card; the
    // EDIT screen swaps the whole area for a single card's editor + a Back
    // button. We intentionally don't use HA's hui-stack-card-editor — it forces
    // a vertical/horizontal-stack model and would fight the `grid` child-layout.
    // Editing only ever touches `cards`, so child-layout (incl. "grid") is kept.

    // Fallback: a single YAML editor for the whole list.
    if (!this._hasNativeEditor) {
      const ed = this._makeObjectEditor(cards, (v) => {
        this._config = { ...this._config, cards: v };
        this._emit();
      });
      this._cardsContainer.appendChild(ed);
      return;
    }

    if (this._openCardIndex != null && this._openCardIndex >= cards.length) {
      this._openCardIndex = null;
    }

    // EDIT screen: only the open card's editor is mounted, full width, with a
    // Back button to return to the list (navigation, like Bubble Card).
    if (this._openCardIndex != null) {
      const index = this._openCardIndex;
      const card = cards[index];

      const bar = document.createElement("div");
      bar.style.display = "flex";
      bar.style.alignItems = "center";
      bar.style.gap = "8px";
      bar.style.marginBottom = "8px";
      bar.appendChild(
        this._iconButton(MDI_ARROW_LEFT, "Back to card list", false, () => this._closeCard())
      );
      const heading = document.createElement("span");
      const type = card && card.type ? String(card.type).replace(/^custom:/, "") : "?";
      heading.textContent = `Card ${index + 1} — ${type}`;
      heading.style.fontWeight = "600";
      bar.appendChild(heading);
      this._cardsContainer.appendChild(bar);

      const ed = this._makeCardEditor(card, (v) => {
        const next = [...this._config.cards];
        next[index] = v;
        this._config = { ...this._config, cards: next };
        this._emit();
      });
      this._listEds.push(ed);
      this._cardsContainer.appendChild(ed);
      return;
    }

    // LIST screen: one light row per card, no nested editor mounted at all.
    cards.forEach((card, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.border = "1px solid var(--divider-color, #e0e0e0)";
      row.style.borderRadius = "8px";
      row.style.padding = "8px";

      const title = document.createElement("span");
      const type = card && card.type ? String(card.type).replace(/^custom:/, "") : "?";
      title.textContent = `Card ${index + 1} — ${type}`;
      title.style.fontWeight = "600";
      title.style.cursor = "pointer";
      title.style.flex = "1";
      title.addEventListener("click", () => this._openCard(index));

      const tools = document.createElement("div");
      tools.appendChild(
        this._iconButton(MDI_ARROW_UP, "Move up", index === 0, () => this._moveCard(index, -1))
      );
      tools.appendChild(
        this._iconButton(MDI_ARROW_DOWN, "Move down", index === cards.length - 1, () =>
          this._moveCard(index, 1)
        )
      );
      tools.appendChild(
        this._iconButton(MDI_PENCIL, "Edit", false, () => this._openCard(index))
      );
      tools.appendChild(
        this._iconButton(MDI_DELETE, "Delete", false, () => this._deleteCard(index))
      );

      row.appendChild(title);
      row.appendChild(tools);
      this._cardsContainer.appendChild(row);
    });

    // Card picker to add a new child card (just like the stack card editor).
    if (customElements.get("hui-card-picker")) {
      const picker = document.createElement("hui-card-picker");
      picker.hass = this._hass;
      picker.lovelace = this._lovelace;
      picker.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const next = [...(this._config.cards || []), ev.detail.config];
        this._config = { ...this._config, cards: next };
        this._emit();
        // Jump straight into editing the card we just added.
        this._openCardIndex = next.length - 1;
        this._renderCardsList();
      });
      this._picker = picker;
      this._cardsContainer.appendChild(picker);
    } else {
      // Fallback: a simple button that appends a new card to edit.
      const add = document.createElement("mwc-button");
      add.setAttribute("raised", "");
      add.textContent = "Add card";
      add.addEventListener("click", () => {
        const next = [...(this._config.cards || []), { type: "entities", entities: [] }];
        this._config = { ...this._config, cards: next };
        this._emit();
        this._openCardIndex = next.length - 1;
        this._renderCardsList();
      });
      this._cardsContainer.appendChild(add);
    }
  }

  // Navigate into a single child card's editor (EDIT screen).
  _openCard(index) {
    this._openCardIndex = index;
    this._renderCardsList();
  }

  // Return from the EDIT screen back to the LIST screen.
  _closeCard() {
    this._openCardIndex = null;
    this._renderCardsList();
  }

  _moveCard(index, delta) {
    const next = [...this._config.cards];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    this._config = { ...this._config, cards: next };
    this._emit();
    this._renderCardsList();
  }

  _deleteCard(index) {
    const next = [...this._config.cards];
    next.splice(index, 1);
    this._config = { ...this._config, cards: next };
    this._emit();
    this._renderCardsList();
  }
}

if (!customElements.get("expander-card-editor")) {
  customElements.define("expander-card-editor", ExpanderCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "expander-card")) {
  window.customCards.push({
    type: "expander-card",
    name: "Expander Card",
    description: "A header card that slides open to reveal child cards underneath.",
    preview: true,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
  });
}

console.info(
  `%c EXPANDER-CARD %c v${VERSION} `,
  "color: white; background: #3b82f6; font-weight: 700;",
  "color: #3b82f6; background: white; font-weight: 700;"
);
