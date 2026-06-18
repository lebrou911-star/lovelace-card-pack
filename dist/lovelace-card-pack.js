/*! lovelace-card-pack v0.1.0 | https://github.com/lebrou911-star/lovelace-card-pack */
(() => {
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
    // Find the content column the card sits in (the section / view container), so
    // breakout can match it — full width on mobile, the centered column on desktop.
    _contentRect() {
      const cParent = (n) => {
        if (n.assignedSlot) return n.assignedSlot;
        const p = n.parentNode;
        if (!p) return null;
        if (p.nodeType === 11) return p.host || null;
        return p;
      };
      try {
        let node = this;
        let guard = 0;
        while (node && guard++ < 40) {
          const tag = node.tagName;
          if (tag === "HUI-SECTION") {
            const inner = node.shadowRoot && node.shadowRoot.querySelector(".container");
            return (inner || node).getBoundingClientRect();
          }
          if (tag === "HUI-MASONRY-VIEW" || tag === "HUI-VIEW" || tag === "HUI-PANEL-VIEW") {
            return node.getBoundingClientRect();
          }
          node = cParent(node);
        }
      } catch (e) {
      }
      return null;
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
      const margin = Number(this._config["breakout-margin"]) || 0;
      let width, leftViewport;
      if (breakout) {
        const cr = this._contentRect();
        if (cr && cr.width) {
          width = cr.width;
          leftViewport = cr.left;
        } else {
          const vw = document.documentElement.clientWidth || window.innerWidth;
          width = vw - margin * 2;
          leftViewport = (vw - width) / 2;
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
  customElements.define("expander-card", ExpanderCard);
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
  customElements.define("expander-card-editor", ExpanderCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "expander-card",
    name: "Expander Card",
    description: "A header card that slides open to reveal child cards underneath.",
    preview: true,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack"
  });
  console.info(
    `%c EXPANDER-CARD %c v${VERSION} `,
    "color: white; background: #3b82f6; font-weight: 700;",
    "color: #3b82f6; background: white; font-weight: 700;"
  );

  // src/index.js
  var VERSION2 = true ? "0.1.0" : "dev";
  console.info(
    `%c LOVELACE-CARD-PACK %c v${VERSION2} `,
    "color: white; background: #6d28d9; font-weight: 700; border-radius: 3px 0 0 3px;",
    "color: #6d28d9; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
  );
})();
