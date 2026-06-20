/*! lovelace-card-pack v0.2.4 | https://github.com/lebrou911-star/lovelace-card-pack */
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/expander-card/expander-card.js
  var VERSION = "0.19.0";
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
  var ExpanderCard = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._expanded = false;
      this._headerEl = null;
      this._childEls = [];
      this._built = false;
      this._onResize = () => this._applyBreakout();
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
        ...config
      };
      if (!Array.isArray(this._config.cards)) this._config.cards = [];
      this._expanded = !!this._config.expanded;
      this._built = false;
      if (this.shadowRoot) this._build();
    }
    set hass(hass) {
      this._hass = hass;
      if (this._headerEl) this._headerEl.hass = hass;
      this._childEls.forEach((el) => el.hass = hass);
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
      this._headerEl = headerConfig && headerConfig.type ? await this._createCardElement(headerConfig) : null;
      const headerHolder = document.createElement("div");
      headerHolder.className = "header-card";
      this._headerHolderEl = headerHolder;
      const headerWidth = resolveHeaderWidth(this._config["header-width"]);
      if (headerWidth) headerHolder.style.maxWidth = headerWidth;
      const useOverlay = expandOn === "header";
      if (expandOn === "both") {
        headerHolder.classList.add("header-clickable");
        headerHolder.addEventListener("click", (ev) => {
          const path = ev.composedPath();
          const interactive = path.some(
            (n) => n.nodeName && /^(HA-SWITCH|HA-SLIDER|INPUT|SELECT|MWC-|HA-ICON-BUTTON)/.test(n.nodeName)
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
        headerHolder.appendChild(chevron);
      }
      if (useOverlay) {
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
      const columns = parseInt(this._config.columns, 10) || 0;
      const inner = document.createElement("div");
      inner.className = "children-inner";
      if (columns >= 1) {
        inner.classList.add("grid");
        inner.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      } else if (horizontal) {
        inner.classList.add("horizontal");
      }
      this._childEls = [];
      for (const childConfig of this._config.cards) {
        const el = await this._createCardElement(childConfig);
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
      this._headerHolderEl.style.boxShadow = this._expanded && col ? `0 0 0 2px ${col}` : "";
    }
    // Walk up the (shadow-piercing) ancestor chain.
    _climb(visit) {
      const cParent = (n) => {
        if (n.assignedSlot) return n.assignedSlot;
        const p = n.parentNode;
        if (!p) return null;
        if (p.nodeType === 11) return p.host || null;
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
          if (tag === "HA-DIALOG") {
            const surface = node.shadowRoot && node.shadowRoot.querySelector(".mdc-dialog__surface");
            const r = (surface || node).getBoundingClientRect();
            if (r && r.width && r.width < vw) return r;
          }
          if (node.classList && (node.classList.contains("bubble-pop-up") || node.classList.contains("bubble-pop-up-container"))) {
            const r = node.getBoundingClientRect();
            if (r && r.width && r.width < vw) return r;
          }
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
      let width, leftViewport;
      if (breakout) {
        const margin = Number(this._config["breakout-margin"]) || 0;
        const cr = this._contentRect();
        if (cr && cr.width) {
          width = cr.width;
          leftViewport = cr.left;
        } else {
          const pr = this._popupRect();
          if (pr && pr.width) {
            width = pr.width - margin * 2;
            leftViewport = pr.left + margin;
          } else {
            const vw = document.documentElement.clientWidth || window.innerWidth;
            width = vw - margin * 2;
            leftViewport = (vw - width) / 2;
          }
        }
        const maxW = Number(this._config["breakout-max"]) || 0;
        if (maxW > 0 && maxW < width) {
          leftViewport += (width - maxW) / 2;
          width = maxW;
        }
      } else {
        width = rect.width;
        leftViewport = rect.left;
      }
      if (drop > 0) {
        el.style.position = "absolute";
        el.style.top = `calc(100% + ${drop}px)`;
        el.style.zIndex = "6";
        el.style.left = `${leftViewport - rect.left}px`;
        el.style.width = `${width}px`;
        return;
      }
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
        window.dispatchEvent(
          new CustomEvent("expander-card:opened", {
            detail: { group: this._config.group, source: this }
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
      return {
        "expand-on": "both",
        expanded: false,
        header: {},
        cards: []
      };
    }
  };
  if (customElements.get("expander-card")) {
    console.warn(
      "[lovelace-card-pack] 'expander-card' is already registered by another resource. Remove the standalone Expander Card HACS resource to use the one bundled in the pack."
    );
  } else {
    customElements.define("expander-card", ExpanderCard);
  }
  var EDITOR_SCHEMA = [
    {
      name: "expand-on",
      selector: {
        select: {
          mode: "dropdown",
          options: [
            { value: "header", label: "Header only — tap the card, no chevron" },
            { value: "chevron", label: "Chevron only — tap the arrow" },
            { value: "both", label: "Both (header + chevron)" }
          ]
        }
      }
    },
    { name: "columns", selector: { number: { min: 0, max: 12, mode: "box" } } },
    { name: "header-width", selector: { number: { min: 0, max: 12, mode: "box" } } },
    { name: "gap", selector: { number: { min: 0, max: 64, mode: "box", unit_of_measurement: "px" } } },
    { name: "breakout", selector: { boolean: {} } },
    { name: "breakout-margin", selector: { number: { min: 0, max: 64, mode: "box", unit_of_measurement: "px" } } },
    { name: "breakout-max", selector: { number: { min: 0, max: 2e3, mode: "box", unit_of_measurement: "px" } } },
    { name: "drop", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "px" } } },
    { name: "group", selector: { text: {} } },
    { name: "border-color", selector: { text: {} } },
    { name: "expanded", selector: { boolean: {} } }
  ];
  var EDITOR_LABELS = {
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
    expanded: "Start expanded"
  };
  var MDI_DELETE = "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";
  var MDI_ARROW_UP = "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z";
  var MDI_ARROW_DOWN = "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z";
  var MDI_CODE_BRACES = "M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11H3V13H4A2,2 0 0,1 6,15V19A2,2 0 0,0 8,21H10V19H8V14A2,2 0 0,0 6,12A2,2 0 0,0 8,10V5H10V3M16,3A2,2 0 0,1 18,5V9A2,2 0 0,0 20,11H21V13H20A2,2 0 0,1 18,15V19A2,2 0 0,1 16,21H14V19H16V14A2,2 0 0,1 18,12A2,2 0 0,1 16,10V5H14V3H16Z";
  var ExpanderCardEditor = class extends HTMLElement {
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
        ...config
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
      }
      await Promise.race([
        Promise.all(need.map((n) => customElements.whenDefined(n))),
        new Promise((r) => setTimeout(r, 2e3))
      ]);
      const ready = customElements.get("hui-stack-card-editor") || customElements.get("hui-card-element-editor");
      if (ready && !this._upgraded) {
        this._upgraded = true;
        this._rendered = false;
        this._render();
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
      [this._headerEd, this._picker, this._stackEd, ...this._listEds || []].forEach((el) => {
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
        expanded: !!this._config.expanded
      };
    }
    _emit() {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true
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
      if (customElements.get("hui-stack-card-editor")) {
        const horizontal = this._config["child-layout"] === "horizontal";
        const ed = document.createElement("hui-stack-card-editor");
        ed.hass = this._hass;
        ed.lovelace = this._lovelace;
        ed.setConfig({
          type: horizontal ? "horizontal-stack" : "vertical-stack",
          cards: this._config.cards || []
        });
        ed.addEventListener("config-changed", (ev) => {
          ev.stopPropagation();
          const cfg = ev.detail.config || {};
          this._config = {
            ...this._config,
            cards: Array.isArray(cfg.cards) ? cfg.cards : [],
            "child-layout": cfg.type === "horizontal-stack" ? "horizontal" : "vertical"
          };
          this._emit();
        });
        this._stackEd = ed;
        this._cardsContainer.appendChild(ed);
        return;
      }
      if (!this._hasNativeEditor) {
        const ed = this._makeObjectEditor(cards, (v) => {
          this._config = { ...this._config, cards: v };
          this._emit();
        });
        this._cardsContainer.appendChild(ed);
        return;
      }
      cards.forEach((card, index) => {
        const row = document.createElement("div");
        row.style.border = "1px solid var(--divider-color, #e0e0e0)";
        row.style.borderRadius = "8px";
        row.style.padding = "8px";
        const bar = document.createElement("div");
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.justifyContent = "space-between";
        const title = document.createElement("span");
        title.textContent = `Card ${index + 1}`;
        title.style.fontWeight = "600";
        const tools = document.createElement("div");
        tools.appendChild(
          this._iconButton(
            MDI_ARROW_UP,
            "Move up",
            index === 0,
            () => this._moveCard(index, -1)
          )
        );
        tools.appendChild(
          this._iconButton(
            MDI_ARROW_DOWN,
            "Move down",
            index === cards.length - 1,
            () => this._moveCard(index, 1)
          )
        );
        tools.appendChild(
          this._iconButton(MDI_DELETE, "Delete", false, () => this._deleteCard(index))
        );
        bar.appendChild(title);
        bar.appendChild(tools);
        row.appendChild(bar);
        const ed = this._makeCardEditor(card, (v) => {
          const next = [...this._config.cards];
          next[index] = v;
          this._config = { ...this._config, cards: next };
          this._emit();
        });
        this._listEds.push(ed);
        row.appendChild(ed);
        this._cardsContainer.appendChild(row);
      });
      if (customElements.get("hui-card-picker")) {
        const picker = document.createElement("hui-card-picker");
        picker.hass = this._hass;
        picker.lovelace = this._lovelace;
        picker.addEventListener("config-changed", (ev) => {
          ev.stopPropagation();
          const next = [...this._config.cards || [], ev.detail.config];
          this._config = { ...this._config, cards: next };
          this._emit();
          this._renderCardsList();
        });
        this._picker = picker;
        this._cardsContainer.appendChild(picker);
      } else {
        const add = document.createElement("mwc-button");
        add.setAttribute("raised", "");
        add.textContent = "Add card";
        add.addEventListener("click", () => {
          const next = [...this._config.cards || [], { type: "entities", entities: [] }];
          this._config = { ...this._config, cards: next };
          this._emit();
          this._renderCardsList();
        });
        this._cardsContainer.appendChild(add);
      }
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
  };
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
      documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack"
    });
  }
  console.info(
    `%c EXPANDER-CARD %c v${VERSION} `,
    "color: white; background: #3b82f6; font-weight: 700;",
    "color: #3b82f6; background: white; font-weight: 700;"
  );

  // src/minimalistic-area-card-plus/editor.js
  function fireEvent(node, type, detail) {
    const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
    event.detail = detail || {};
    node.dispatchEvent(event);
    return event;
  }
  function isTemplate(v) {
    return typeof v === "string" && /\{\{|\{%|\{#/.test(v);
  }
  var MAIN_SCHEMA = [
    {
      name: "title",
      selector: { text: {} }
    },
    {
      type: "grid",
      schema: [
        {
          name: "title_size",
          selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "px" } }
        },
        { name: "title_color", selector: { text: {} } }
      ]
    },
    {
      name: "area",
      selector: { area: {} }
    },
    {
      type: "grid",
      schema: [
        { name: "image", selector: { text: {} } },
        { name: "camera_image", selector: { entity: { domain: "camera" } } }
      ]
    },
    {
      type: "grid",
      schema: [
        { name: "darken_image", selector: { boolean: {} } },
        { name: "shadow", selector: { boolean: {} } },
        { name: "state_color", selector: { boolean: {} } },
        { name: "hide_unavailable", selector: { boolean: {} } }
      ]
    },
    {
      type: "grid",
      schema: [
        {
          name: "icon_size",
          selector: { number: { min: 10, max: 400, step: 1, mode: "box", unit_of_measurement: "%" } }
        }
      ]
    },
    {
      name: "interactions",
      type: "expandable",
      iconPath: "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
      schema: [
        { name: "tap_action", selector: { ui_action: {} } },
        { name: "hold_action", selector: { ui_action: {} } },
        { name: "double_tap_action", selector: { ui_action: {} } }
      ]
    }
  ];
  var ALIGN_SCHEMA = [
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
                { value: "baseline", label: "Baseline" }
              ]
            }
          }
        },
        {
          name: "value_justify",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "start", label: "Left (default)" },
                { value: "center", label: "Center" },
                { value: "end", label: "Right" }
              ]
            }
          }
        }
      ]
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
                { value: "nowrap", label: "Truncate (…)" }
              ]
            }
          }
        },
        {
          name: "value_min_width",
          selector: { number: { min: 0, max: 200, step: 1, mode: "box", unit_of_measurement: "px" } }
        },
        {
          name: "sensor_columns",
          selector: { number: { min: 0, max: 6, step: 1, mode: "box" } }
        }
      ]
    }
  ];
  var LABELS = {
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
    sensor_columns: "Sensor columns"
  };
  var HELPERS = {
    title: "Plain text or a Jinja template, e.g. Salon — {{ states('sensor.temp') }}°.",
    title_color: "Named colour, #hex, or a template. Leave empty for the default.",
    icon_size: "Default icon size, as a % of the normal look. 100 = unchanged. Override per entity below.",
    item_align: "Vertical alignment of each icon + value pair in the bottom row.",
    value_justify: "How the value text sits within its column.",
    value_wrap: "Truncate keeps text on one line so rows stay aligned.",
    value_min_width: "Reserve a fixed width for values so text (e.g. “idle”) and numbers line up. 0 = auto.",
    sensor_columns: "Lay sensors out in an aligned grid of N columns. 0 = inline flow (original look)."
  };
  var mdiPath = {
    up: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
    down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
    remove: "M19,13H5V11H19V13Z",
    drag: "M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z"
  };
  var MinimalisticAreaCardPlusEditor = class extends HTMLElement {
    constructor() {
      super();
      __publicField(this, "_computeLabel", (schema) => LABELS[schema.name] || schema.name);
      __publicField(this, "_computeHelper", (schema) => HELPERS[schema.name] || "");
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = void 0;
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
          .hint { color: var(--secondary-text-color); font-size: 0.85em; margin: 0 0 4px; line-height: 1.3; }
        </style>
        <div class="editor">
          <div id="main"></div>
          <div>
            <div class="section-title">Entities</div>
            <div class="hint">Reorder by dragging the ⠿ handle (or the arrows); per-entity icon, name, colour, size, badge and tap action.</div>
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
      const iconIsTpl = isTemplate(conf.icon);
      const iconPicker = document.createElement("ha-icon-picker");
      iconPicker.hass = this._hass;
      iconPicker.value = iconIsTpl ? "" : conf.icon || "";
      iconPicker.label = "Icon (optional)";
      iconPicker.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const v = ev.detail.value;
        const current = this._normalizeEntity(this._entities[index] || {}).icon;
        if (!v && isTemplate(current)) return;
        this._updateEntity(index, "icon", v);
      });
      row.appendChild(iconPicker);
      const nameField = document.createElement("ha-textfield");
      nameField.label = "Name (optional)";
      nameField.outlined = true;
      nameField.value = conf.name || "";
      nameField.addEventListener("input", (ev) => {
        this._updateEntity(
          index,
          "name",
          ev.target.value,
          /* silent */
          true
        );
      });
      nameField.addEventListener("change", (ev) => {
        this._updateEntity(index, "name", ev.target.value);
      });
      row.appendChild(nameField);
      const iconTpl = document.createElement("ha-textfield");
      iconTpl.label = "Icon (template {{ }})";
      iconTpl.outlined = true;
      iconTpl.classList.add("full");
      iconTpl.value = iconIsTpl ? conf.icon : "";
      const setIconTpl = (ev) => this._updateEntity(
        index,
        "icon",
        ev.target.value,
        /* silent */
        true
      );
      iconTpl.addEventListener("input", setIconTpl);
      iconTpl.addEventListener("change", setIconTpl);
      row.appendChild(iconTpl);
      const advancedHint = document.createElement("div");
      advancedHint.className = "full hint";
      advancedHint.textContent = "Pick a static icon above, or type a Jinja template ({{ … }}) in the “template” field. Colour & badge colour also accept templates.";
      row.appendChild(advancedHint);
      const colorField = document.createElement("ha-textfield");
      colorField.label = "Icon colour (optional)";
      colorField.outlined = true;
      colorField.value = conf.color || "";
      colorField.addEventListener("input", (ev) => {
        this._updateEntity(
          index,
          "color",
          ev.target.value,
          /* silent */
          true
        );
      });
      colorField.addEventListener("change", (ev) => {
        this._updateEntity(index, "color", ev.target.value);
      });
      row.appendChild(colorField);
      const sizeField = document.createElement("ha-textfield");
      sizeField.label = "Icon size %";
      sizeField.outlined = true;
      sizeField.type = "number";
      sizeField.value = conf.icon_size != null ? conf.icon_size : "";
      const sizeVal = (raw) => raw === "" || raw == null ? "" : Number(raw);
      sizeField.addEventListener("input", (ev) => {
        this._updateEntity(
          index,
          "icon_size",
          sizeVal(ev.target.value),
          /* silent */
          true
        );
      });
      sizeField.addEventListener("change", (ev) => {
        this._updateEntity(index, "icon_size", sizeVal(ev.target.value));
      });
      row.appendChild(sizeField);
      const badgeIsTpl = isTemplate(conf.badge_icon);
      const badgeIconPicker = document.createElement("ha-icon-picker");
      badgeIconPicker.hass = this._hass;
      badgeIconPicker.value = badgeIsTpl ? "" : conf.badge_icon || "";
      badgeIconPicker.label = "Badge icon (optional)";
      badgeIconPicker.classList.add("full");
      badgeIconPicker.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const v = ev.detail.value;
        const current = this._normalizeEntity(this._entities[index] || {}).badge_icon;
        if (!v && isTemplate(current)) return;
        this._updateEntity(index, "badge_icon", v);
      });
      row.appendChild(badgeIconPicker);
      const badgeIconTpl = document.createElement("ha-textfield");
      badgeIconTpl.label = "Badge icon (template {{ }})";
      badgeIconTpl.outlined = true;
      badgeIconTpl.classList.add("full");
      badgeIconTpl.value = badgeIsTpl ? conf.badge_icon : "";
      const setBadgeTpl = (ev) => this._updateEntity(
        index,
        "badge_icon",
        ev.target.value,
        /* silent */
        true
      );
      badgeIconTpl.addEventListener("input", setBadgeTpl);
      badgeIconTpl.addEventListener("change", setBadgeTpl);
      row.appendChild(badgeIconTpl);
      const badgeColorField = document.createElement("ha-textfield");
      badgeColorField.label = "Badge colour / condition (optional)";
      badgeColorField.outlined = true;
      badgeColorField.classList.add("full");
      badgeColorField.value = conf.badge_color || "";
      badgeColorField.addEventListener("input", (ev) => {
        this._updateEntity(
          index,
          "badge_color",
          ev.target.value,
          /* silent */
          true
        );
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
      const tools = document.createElement("div");
      tools.className = "row-tools";
      const dragHandle = this._toolButton(mdiPath.drag, "Drag to reorder", false, () => {
      });
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
      row.addEventListener("dragstart", (ev) => {
        this._dragIndex = index;
        row.classList.add("dragging");
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = "move";
          try {
            ev.dataTransfer.setData("text/plain", String(index));
          } catch (_e) {
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
      if (value === "" || value === void 0 || value === null) {
        delete entities[index][key];
      } else {
        entities[index][key] = value;
      }
      const collapsed = entities.map((e) => Object.keys(e).length === 1 && e.entity ? e.entity : e);
      this._emit({ ...this._config, entities: collapsed });
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
  };

  // src/minimalistic-area-card-plus/minimalistic-area-card-plus.js
  var VERSION2 = true ? "0.2.4" : "dev";
  var CARD_TYPE = "minimalistic-area-card-plus";
  var EDITOR_TYPE = "minimalistic-area-card-plus-editor";
  var UNAVAILABLE = "unavailable";
  var STATES_OFF = ["closed", "locked", "off", UNAVAILABLE, "idle", "disconnected", "standby"];
  var SENSORS = ["sensor", "binary_sensor"];
  var DOMAINS_TOGGLE = ["fan", "input_boolean", "light", "switch", "group", "automation", "humidifier"];
  var ITEM_ALIGN = { top: "flex-start", middle: "center", bottom: "flex-end", baseline: "baseline" };
  var VALUE_JUSTIFY = { start: "flex-start", center: "center", end: "flex-end" };
  function fireEvent2(node, type, detail) {
    const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
    event.detail = detail || {};
    node.dispatchEvent(event);
    return event;
  }
  function hasAction(config) {
    return config !== void 0 && config.action !== "none";
  }
  function handleAction(node, hass, actionConfig, fallbackEntityId) {
    if (!actionConfig) return;
    const action = actionConfig.action || "more-info";
    switch (action) {
      case "none":
        break;
      case "more-info": {
        const entityId = actionConfig.entity || fallbackEntityId;
        if (entityId) fireEvent2(node, "hass-more-info", { entityId });
        break;
      }
      case "navigate": {
        if (!actionConfig.navigation_path) return;
        history.pushState(null, "", actionConfig.navigation_path);
        fireEvent2(window, "location-changed", { replace: false });
        break;
      }
      case "url": {
        if (actionConfig.url_path) window.open(actionConfig.url_path);
        break;
      }
      case "toggle": {
        if (fallbackEntityId) {
          hass.callService("homeassistant", "toggle", { entity_id: fallbackEntityId });
        }
        break;
      }
      case "perform-action":
      case "call-service": {
        const svc = actionConfig.perform_action || actionConfig.service;
        if (!svc) return;
        const [domain, service] = svc.split(".", 2);
        hass.callService(domain, service, actionConfig.data || actionConfig.service_data, actionConfig.target);
        break;
      }
      default:
        break;
    }
  }
  function attachAction(el, opts, callback) {
    const { hasHold, hasDoubleClick } = opts;
    let holdTimer = null;
    let held = false;
    let lastTap = 0;
    const clearHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };
    el.addEventListener("pointerdown", () => {
      held = false;
      if (hasHold) {
        clearHold();
        holdTimer = setTimeout(() => {
          held = true;
          callback("hold");
        }, 500);
      }
    });
    el.addEventListener("pointerup", clearHold);
    el.addEventListener("pointercancel", clearHold);
    el.addEventListener("pointerleave", clearHold);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (held) {
        held = false;
        return;
      }
      if (hasDoubleClick) {
        const now = Date.now();
        if (now - lastTap < 300) {
          lastTap = 0;
          callback("double_tap");
          return;
        }
        lastTap = now;
        setTimeout(() => {
          if (lastTap !== 0) {
            lastTap = 0;
            callback("tap");
          }
        }, 300);
        return;
      }
      callback("tap");
    });
  }
  var MinimalisticAreaCardPlus = class _MinimalisticAreaCardPlus extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = void 0;
      this._hass = void 0;
      this._area = void 0;
      this._areaEntities = void 0;
      this._built = false;
      this._tpl = /* @__PURE__ */ new Map();
    }
    disconnectedCallback() {
      this._clearTemplates();
    }
    static getConfigElement() {
      return document.createElement(EDITOR_TYPE);
    }
    static getStubConfig(hass) {
      const firstArea = hass && hass.areas ? hass.areas[Object.keys(hass.areas)[0]] : void 0;
      const config = {
        type: `custom:${CARD_TYPE}`,
        title: firstArea ? firstArea.name : "Living Room",
        entities: []
      };
      if (firstArea) config.area = firstArea.area_id;
      return config;
    }
    setConfig(config) {
      if (!config || config.entities && !Array.isArray(config.entities)) {
        throw new Error("Invalid configuration");
      }
      this._config = { hold_action: { action: "more-info" }, ...config };
      this._built = false;
      this._clearTemplates();
      if (this._hass) this._render();
    }
    getCardSize() {
      return 3;
    }
    set hass(hass) {
      const oldHass = this._hass;
      this._hass = hass;
      if (!this._config) return;
      if (this._shouldUpdate(oldHass)) this._render();
    }
    get hass() {
      return this._hass;
    }
    /* ----- area / entity resolution ----- */
    _setArea() {
      const hass = this._hass;
      this._area = void 0;
      this._areaEntities = void 0;
      if (!hass || !this._config || !this._config.area) return;
      const area = hass.areas && hass.areas[this._config.area];
      if (area) {
        this._area = area;
        this._areaEntities = _MinimalisticAreaCardPlus._findAreaEntities(hass, area.area_id);
      }
    }
    static _findAreaEntities(hass, areaId) {
      if (!hass.entities) return [];
      return Object.keys(hass.entities).filter((e) => {
        var _a;
        const ent = hass.entities[e];
        return !ent.disabled_by && !ent.hidden && ent.entity_category !== "diagnostic" && ent.entity_category !== "config" && (ent.area_id === areaId || ent.device_id && ((_a = hass.devices[ent.device_id]) == null ? void 0 : _a.area_id) === areaId);
      });
    }
    _parseEntity(item) {
      return typeof item === "string" ? { entity: item } : item;
    }
    _classifyEntities() {
      const sensor = [];
      const buttons = [];
      const entities = this._config && this._config.entities || this._areaEntities || [];
      for (const item of entities) {
        const entity = this._parseEntity(item);
        if (!entity || !entity.entity) continue;
        const domain = entity.entity.split(".")[0];
        if (SENSORS.indexOf(domain) !== -1 || entity.attribute) {
          sensor.push(entity);
        } else {
          const dialog = this._config.force_dialog || DOMAINS_TOGGLE.indexOf(domain) === -1;
          buttons.push({ conf: entity, dialog });
        }
      }
      return { sensor, buttons };
    }
    /* ----- Jinja templates ----- */
    // True if a config value looks like a Home Assistant Jinja template.
    static _isTemplate(value) {
      return typeof value === "string" && /\{\{|\{%|\{#/.test(value);
    }
    // Resolve a config value: plain strings pass through; templates return their
    // last rendered result (subscribing on first sight). Returns "" until the
    // first render arrives so the card never shows raw `{{ ... }}`.
    _resolve(value) {
      if (!_MinimalisticAreaCardPlus._isTemplate(value)) return value;
      this._subscribeTemplate(value);
      const entry = this._tpl.get(value);
      return entry && entry.result !== void 0 ? entry.result : "";
    }
    _subscribeTemplate(str) {
      let entry = this._tpl.get(str);
      if (!entry) {
        entry = { result: void 0, unsub: null, subscribed: false };
        this._tpl.set(str, entry);
      }
      if (entry.subscribed || !this._hass || !this._hass.connection) return;
      entry.subscribed = true;
      this._hass.connection.subscribeMessage(
        (msg) => {
          entry.result = msg.result;
          this._render();
        },
        { type: "render_template", template: str, report_errors: true }
      ).then((unsub) => {
        entry.unsub = unsub;
      }).catch(() => {
        entry.subscribed = false;
      });
    }
    _clearTemplates() {
      for (const entry of this._tpl.values()) {
        if (typeof entry.unsub === "function") {
          try {
            entry.unsub();
          } catch (_e) {
          }
        }
      }
      this._tpl.clear();
    }
    _shouldUpdate(oldHass) {
      if (!oldHass) return true;
      if (oldHass.themes !== this._hass.themes || oldHass.locale !== this._hass.locale) return true;
      this._setArea();
      const { sensor, buttons } = this._classifyEntities();
      for (const e of [...sensor, ...buttons.map((b) => b.conf)]) {
        if (oldHass.states[e.entity] !== this._hass.states[e.entity]) return true;
      }
      if (this._config.area && oldHass.areas !== this._hass.areas) return true;
      return false;
    }
    /* ----- rendering ----- */
    _render() {
      var _a, _b, _c, _d;
      if (!this._config || !this._hass) return;
      this._setArea();
      if (!this._built) {
        this.shadowRoot.innerHTML = `<style>${_MinimalisticAreaCardPlus.styles}</style>`;
        this._card = document.createElement("ha-card");
        this._card.tabIndex = hasAction(this._config.tap_action) ? 0 : -1;
        attachAction(
          this._card,
          { hasHold: hasAction(this._config.hold_action), hasDoubleClick: hasAction(this._config.double_tap_action) },
          (actionName) => this._handleThisAction(actionName)
        );
        this.shadowRoot.appendChild(this._card);
        this._built = true;
      }
      const cfg = this._config;
      const hass = this._hass;
      this._card.style.backgroundColor = this._resolve(cfg.background_color) || "";
      const configImage = this._resolve(cfg.image);
      let imageUrl;
      if (!cfg.camera_image && (configImage || ((_a = this._area) == null ? void 0 : _a.picture))) {
        try {
          const base = ((_c = (_b = hass.auth) == null ? void 0 : _b.data) == null ? void 0 : _c.hassUrl) || "";
          imageUrl = new URL(configImage || this._area.picture, base || window.location.origin).toString();
        } catch (_e) {
          imageUrl = configImage || ((_d = this._area) == null ? void 0 : _d.picture);
        }
      }
      const { sensor, buttons } = this._classifyEntities();
      const itemAlign = ITEM_ALIGN[cfg.item_align] || ITEM_ALIGN.middle;
      const valueJustify = VALUE_JUSTIFY[cfg.value_justify] || VALUE_JUSTIFY.start;
      const valueWrap = cfg.value_wrap === "nowrap";
      const valueMinWidth = Number(cfg.value_min_width) > 0 ? `${Number(cfg.value_min_width)}px` : "";
      const columns = Number(cfg.sensor_columns) > 0 ? Number(cfg.sensor_columns) : 0;
      this._card.innerHTML = "";
      if (imageUrl) {
        const img = document.createElement("img");
        img.src = imageUrl;
        if (cfg.darken_image) img.className = "darken";
        this._card.appendChild(img);
      } else if (cfg.camera_image) {
        const camera = document.createElement("div");
        camera.className = "camera" + (cfg.darken_image ? " darken" : "");
        const huiImage = document.createElement("hui-image");
        huiImage.hass = hass;
        huiImage.cameraImage = cfg.camera_image;
        huiImage.entity = cfg.camera_image;
        huiImage.cameraView = cfg.camera_view || "auto";
        huiImage.width = "100%";
        camera.appendChild(huiImage);
        this._card.appendChild(camera);
      }
      const box = document.createElement("div");
      box.className = "box";
      const header = document.createElement("div");
      header.className = "card-header";
      const titleText = this._resolve(cfg.title);
      header.textContent = titleText == null ? "" : String(titleText);
      if (cfg.title_size != null && cfg.title_size !== "") {
        const ts = String(cfg.title_size).trim();
        header.style.fontSize = /^[0-9.]+$/.test(ts) ? `${ts}px` : ts;
      }
      const titleColor = this._resolve(cfg.title_color);
      if (titleColor) header.style.color = titleColor;
      box.appendChild(header);
      const sensorsEl = document.createElement("div");
      sensorsEl.className = "sensors";
      if (columns > 0) {
        sensorsEl.classList.add("grid");
        sensorsEl.style.gridTemplateColumns = `repeat(${columns}, max-content)`;
      }
      sensor.forEach((conf) => {
        const node = this._renderEntity(conf, true, true, { itemAlign, valueJustify, valueWrap, valueMinWidth });
        if (node) sensorsEl.appendChild(node);
      });
      box.appendChild(sensorsEl);
      const buttonsEl = document.createElement("div");
      buttonsEl.className = "buttons";
      buttons.forEach(({ conf, dialog }) => {
        const node = this._renderEntity(conf, dialog, false, {});
        if (node) buttonsEl.appendChild(node);
      });
      box.appendChild(buttonsEl);
      this._card.appendChild(box);
    }
    _renderEntity(entityConf, dialog, isSensor, align) {
      var _a;
      const hass = this._hass;
      const cfg = this._config;
      const stateObj = hass.states[entityConf.entity];
      const entityReg = hass.entities ? hass.entities[entityConf.entity] : void 0;
      entityConf = {
        tap_action: { action: dialog ? "more-info" : "toggle" },
        hold_action: { action: "more-info" },
        show_state: entityConf.show_state === void 0 ? true : !!entityConf.show_state,
        ...entityConf
      };
      const unavailable = !stateObj || stateObj.state === UNAVAILABLE;
      if (unavailable && cfg.hide_unavailable) return null;
      if (unavailable) {
        const wrapper2 = document.createElement("div");
        wrapper2.className = "wrapper";
        const warn = document.createElement("hui-warning-element");
        warn.label = `${entityConf.entity || "[empty]"} is unavailable`;
        if (cfg.shadow) warn.className = "shadow";
        wrapper2.appendChild(warn);
        return wrapper2;
      }
      const active = stateObj.state && STATES_OFF.indexOf(String(stateObj.state).toLowerCase()) === -1;
      const resolvedName = this._resolve(entityConf.name);
      const friendly = resolvedName || ((_a = stateObj.attributes) == null ? void 0 : _a.friendly_name) || stateObj.entity_id;
      const resolvedIcon = this._resolve(entityConf.icon);
      const resolvedColor = this._resolve(entityConf.color);
      const wrapper = document.createElement("div");
      wrapper.className = "wrapper";
      if (isSensor && align && align.itemAlign) wrapper.style.alignItems = align.itemAlign;
      const iconButton = document.createElement("ha-icon-button");
      iconButton.className = active ? "state-on" : "";
      const sizePct = Number(entityConf.icon_size != null ? entityConf.icon_size : cfg.icon_size);
      const factor = isFinite(sizePct) && sizePct > 0 ? sizePct / 100 : 1;
      const zoom = (isSensor ? 0.67 : 1) * factor;
      if (zoom !== 1) {
        iconButton.style.zoom = String(zoom);
        iconButton.style.MozTransform = `scale(${zoom})`;
      }
      const badge = document.createElement("state-badge");
      badge.hass = hass;
      badge.stateObj = stateObj;
      badge.title = friendly;
      if (resolvedIcon) badge.overrideIcon = resolvedIcon;
      if (resolvedColor) {
        badge.stateColor = false;
        badge.style.color = resolvedColor;
      } else {
        badge.stateColor = entityConf.state_color !== void 0 ? entityConf.state_color : cfg.state_color !== void 0 ? cfg.state_color : true;
      }
      if (cfg.shadow) badge.className = "shadow";
      const iconWrap = document.createElement("div");
      iconWrap.className = "icon-wrap";
      iconButton.appendChild(badge);
      iconWrap.appendChild(iconButton);
      const badgeEl = this._buildBadge(entityConf);
      if (badgeEl) iconWrap.appendChild(badgeEl);
      attachAction(
        iconButton,
        { hasHold: hasAction(entityConf.hold_action), hasDoubleClick: hasAction(entityConf.double_tap_action) },
        (actionName) => {
          const actionConfig = entityConf[`${actionName}_action`];
          handleAction(this, hass, actionConfig, entityConf.entity);
        }
      );
      wrapper.appendChild(iconWrap);
      if (isSensor && entityConf.show_state) {
        const state = document.createElement("div");
        state.className = "state";
        if (align) {
          if (align.valueMinWidth) state.style.minWidth = align.valueMinWidth;
          state.style.justifyContent = align.valueJustify;
          state.style.textAlign = align.valueJustify === "flex-end" ? "right" : align.valueJustify === "center" ? "center" : "left";
          if (align.valueWrap) {
            state.classList.add("nowrap");
          }
        }
        let text;
        if (entityConf.attribute) {
          const a = stateObj.attributes[entityConf.attribute];
          text = `${entityConf.prefix || ""}${a == null ? "" : a}${entityConf.suffix || ""}`;
        } else {
          text = this._computeStateValue(stateObj, entityReg);
        }
        state.textContent = text == null ? "" : text;
        state.title = state.textContent;
        wrapper.appendChild(state);
      }
      return wrapper;
    }
    // Build the optional badge/pill shown over an icon. Driven by badge_color
    // and/or badge_icon (both template-aware). A template that resolves to an
    // empty / "none" colour hides the badge — handy for conditional alerts.
    _buildBadge(entityConf) {
      const color = this._resolve(entityConf.badge_color);
      const icon = this._resolve(entityConf.badge_icon);
      const colorStr = color == null ? "" : String(color).trim();
      const iconStr = icon == null ? "" : String(icon).trim();
      const hidden = ["", "none", "transparent", "false", "off"].indexOf(colorStr.toLowerCase()) !== -1;
      if (hidden && !iconStr) return null;
      const badge = document.createElement("div");
      badge.className = "badge";
      if (!hidden) badge.style.background = colorStr;
      if (iconStr) {
        const haIcon = document.createElement("ha-icon");
        haIcon.icon = iconStr;
        badge.appendChild(haIcon);
        badge.classList.add("has-icon");
      }
      return badge;
    }
    _handleThisAction(actionName) {
      const cfg = this._config;
      const actionConfig = cfg[`${actionName}_action`];
      if (!actionConfig) return;
      handleAction(this, this._hass, actionConfig, void 0);
    }
    /* ----- value formatting (ported from upstream) ----- */
    _isNumericState(stateObj) {
      return !!stateObj.attributes.unit_of_measurement || !!stateObj.attributes.state_class;
    }
    _computeStateValue(stateObj, entityReg) {
      const domain = stateObj.entity_id.split(".")[0];
      if (this._isNumericState(stateObj)) {
        const value = Number(stateObj.state);
        if (isNaN(value)) return null;
        const str = this._formatNumber(value, stateObj, entityReg);
        return `${str}${stateObj.attributes.unit_of_measurement ? " " + stateObj.attributes.unit_of_measurement : ""}`;
      }
      if (domain !== "binary_sensor" && stateObj.state !== "unavailable" && stateObj.state !== "idle") {
        if (this._hass.formatEntityState) {
          try {
            return this._hass.formatEntityState(stateObj);
          } catch (_e) {
          }
        }
        return stateObj.state;
      }
      return null;
    }
    _formatNumber(value, stateObj, entityReg) {
      var _a, _b;
      const precision = entityReg == null ? void 0 : entityReg.display_precision;
      const options = {};
      if (precision != null) {
        options.minimumFractionDigits = precision;
        options.maximumFractionDigits = precision;
      } else if (Number.isInteger(Number((_a = stateObj.attributes) == null ? void 0 : _a.step)) && Number.isInteger(Number(stateObj.state))) {
        options.maximumFractionDigits = 0;
      }
      const locale = ((_b = this._hass.locale) == null ? void 0 : _b.language) || void 0;
      try {
        return new Intl.NumberFormat(locale, options).format(value);
      } catch (_e) {
        return String(value);
      }
    }
    static get styles() {
      return `
      * { box-sizing: border-box; }
      ha-card {
        position: relative;
        min-height: 48px;
        height: 100%;
        z-index: 0;
        overflow: hidden;
      }
      img {
        display: block;
        height: 100%;
        width: 100%;
        object-fit: cover;
        position: absolute;
        z-index: -1;
        pointer-events: none;
        border-radius: var(--ha-card-border-radius, 12px);
      }
      .darken { filter: brightness(0.55); }
      div.camera {
        height: 100%;
        width: 100%;
        overflow: hidden;
        position: absolute;
        left: 0; top: 0;
        z-index: -1;
        pointer-events: none;
        border-radius: var(--ha-card-border-radius, 12px);
      }
      div.camera hui-image {
        position: relative;
        top: 50%;
        transform: translateY(-50%);
      }
      .box {
        text-shadow: 1px 1px 2px black;
        background-color: transparent;
        display: flex;
        flex-flow: column nowrap;
        justify-content: flex-start;
        width: 100%;
        height: 100%;
        padding: 0;
        font-size: 14px;
        color: var(--ha-picture-card-text-color, white);
        z-index: 1;
      }
      .box .card-header {
        padding: 10px 15px;
        font-weight: bold;
        font-size: 1.2em;
      }
      .box .sensors {
        margin-top: -8px;
        margin-bottom: -8px;
        min-height: var(--minimalistic-area-card-sensors-min-height, 10px);
        margin-left: 5px;
        font-size: 0.9em;
        line-height: 13px;
      }
      /* Optional aligned grid layout for the bottom sensor row (plus feature). */
      .box .sensors.grid {
        display: grid;
        gap: 2px 6px;
        align-items: center;
      }
      .box .buttons {
        display: block;
        background-color: transparent;
        text-align: right;
        padding-top: 10px;
        padding-bottom: 10px;
        min-height: 10px;
        width: 100%;
        margin-top: auto;
      }
      .box .buttons ha-icon-button {
        margin-left: -8px;
        margin-right: -6px;
      }
      .box .sensors ha-icon-button {
        /* Size is applied inline (icon_size %); keep alignment here. */
        vertical-align: middle;
      }
      .box .icon-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .box .badge {
        position: absolute;
        top: 0;
        right: 0;
        min-width: 12px;
        height: 12px;
        border-radius: 7px;
        background: var(--primary-color, #03a9f4);
        box-shadow: 0 0 0 1.5px var(--ha-card-background, var(--card-background-color, #1c1c1c));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: white;
        pointer-events: none;
        box-sizing: border-box;
      }
      .box .badge.has-icon {
        padding: 1px;
        min-width: 16px;
        height: 16px;
        border-radius: 9px;
      }
      .box .badge ha-icon {
        --mdc-icon-size: 12px;
        width: 12px;
        height: 12px;
        display: inline-flex;
      }
      .box .wrapper {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
        margin-bottom: -8px;
      }
      .box .sensors.grid .wrapper {
        display: flex;
        margin-bottom: 0;
      }
      .box ha-icon-button state-badge {
        line-height: 0px;
        color: var(--ha-picture-icon-button-color, #a9a9a9);
      }
      .box ha-icon-button state-badge.shadow { filter: drop-shadow(2px 2px 2px gray); }
      .box ha-icon-button.state-on state-badge { color: var(--ha-picture-icon-button-on-color, white); }
      .box .sensors .state {
        display: inline-flex;
        align-items: center;
        margin-left: -9px;
      }
      .box .sensors .state.nowrap {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-block;
      }
      .box .wrapper hui-warning-element { display: block; }
      .box .wrapper hui-warning-element.shadow { filter: drop-shadow(2px 2px 2px gray); }
    `;
    }
  };
  if (!customElements.get(CARD_TYPE)) {
    customElements.define(CARD_TYPE, MinimalisticAreaCardPlus);
  }
  if (!customElements.get(EDITOR_TYPE)) {
    customElements.define(EDITOR_TYPE, MinimalisticAreaCardPlusEditor);
  }
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === CARD_TYPE)) {
    window.customCards.push({
      type: CARD_TYPE,
      name: "Minimalistic Area Card Plus",
      description: "Minimalistic area card with a visual editor and alignment controls for the bottom sensor row. Fork of junalmeida's Minimalistic Area Card.",
      preview: true,
      documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack"
    });
  }
  console.info(
    `%c MINIMALISTIC-AREA-CARD-PLUS %c v${VERSION2} `,
    "color: white; background: #ea580c; font-weight: 700;",
    "color: #ea580c; background: white; font-weight: 700;"
  );

  // src/index.js
  var VERSION3 = true ? "0.2.4" : "dev";
  console.info(
    `%c LOVELACE-CARD-PACK %c v${VERSION3} `,
    "color: white; background: #6d28d9; font-weight: 700; border-radius: 3px 0 0 3px;",
    "color: #6d28d9; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
  );
})();
