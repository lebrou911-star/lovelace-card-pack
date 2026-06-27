/**
 * Expander pair — two separate cards that together behave like a Bubble Card
 * pop-up, kept apart on purpose to avoid confusion:
 *
 *   • <expander-header>  the always-visible button. Tapping it opens the popup
 *                        by navigating to a URL hash (e.g. #garage).
 *   • <expander-child>   the popup content. Hidden (takes no layout space) until
 *                        the URL hash matches its `hash`; then it slides up as a
 *                        dialog. Its content is a SINGLE normal card (`card:`),
 *                        edited exactly like any other card. Use a
 *                        vertical-stack / grid for several children.
 *
 * Link the two by giving them the same `hash`. The browser Back button, a click
 * on the backdrop, or Escape closes the child.
 *
 * Self-contained vanilla JS module imported for its side effects by src/index.js.
 *
 * License: MIT
 */
const VERSION = "0.2.0";

const MDI_CLOSE =
  "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";
const MDI_CHEVRON_RIGHT = "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z";
const MDI_CODE_BRACES =
  "M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11H3V13H4A2,2 0 0,1 6,15V19A2,2 0 0,0 8,21H10V19H8V14A2,2 0 0,0 6,12A2,2 0 0,0 8,10V5H10V3M16,3A2,2 0 0,1 18,5V9A2,2 0 0,0 20,11H21V13H20A2,2 0 0,1 18,15V19A2,2 0 0,1 16,21H14V19H16V14A2,2 0 0,1 18,12A2,2 0 0,1 16,10V5H14V3H16Z";
const MDI_DELETE =
  "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";

// Normalise a hash value to a leading-# anchor (e.g. "garage" -> "#garage").
function normHash(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

// Navigate to a URL hash so the matching <expander-child> opens. pushState adds
// a history entry, so the browser Back button (and the child's own close) pop
// it cleanly — the Bubble Card navigation model.
function openHash(hash) {
  const h = normHash(hash);
  if (!h) return;
  if (window.location.hash !== h) {
    const base = window.location.pathname + window.location.search;
    window.history.pushState(window.history.state, "", base + h);
  }
  // pushState fires neither popstate nor hashchange; tell listeners ourselves.
  window.dispatchEvent(new Event("location-changed"));
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

// ---------------------------------------------------------------------------
// <expander-header> — the visible trigger button
// ---------------------------------------------------------------------------

class ExpanderHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  static getConfigElement() {
    return document.createElement("expander-header-editor");
  }

  static getStubConfig() {
    return { hash: "#popup", title: "Open popup", icon: "mdi:gesture-tap-button" };
  }

  setConfig(config) {
    if (!config || !config.hash) {
      throw new Error("expander-header: 'hash' is required (e.g. hash: '#garage').");
    }
    this._config = config;
    this._hash = normHash(config.hash);
    this._built = false;
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _build() {
    if (this._built) return;
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; cursor: pointer;
        }
        ha-card:hover { background: var(--secondary-background-color); }
        .icon { color: var(--state-icon-color, var(--primary-text-color)); --mdc-icon-size: 24px; }
        .title { flex: 1; font-weight: 600; font-size: 1.05rem; color: var(--primary-text-color); }
        .chev { color: var(--secondary-text-color); --mdc-icon-size: 22px; }
      </style>
      <ha-card>
        ${this._config.icon ? `<ha-icon class="icon" icon="${this._config.icon}"></ha-icon>` : ""}
        <span class="title">${this._config.title || this._hash}</span>
        <ha-svg-icon class="chev"></ha-svg-icon>
      </ha-card>
    `;
    const chev = this.shadowRoot.querySelector(".chev");
    if (chev) chev.path = MDI_CHEVRON_RIGHT;
    this.shadowRoot.querySelector("ha-card").addEventListener("click", () => openHash(this._hash));
    this._built = true;
  }

  getCardSize() {
    return 1;
  }
}

if (!customElements.get("expander-header")) {
  customElements.define("expander-header", ExpanderHeader);
}

// ---------------------------------------------------------------------------
// <expander-child> — the popup content
// ---------------------------------------------------------------------------

class ExpanderChild extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = false;
    this._contentEl = null;
    this._built = false;
    this._onLocationChange = () => this._sync();
    this._onKeyDown = (ev) => {
      if (ev.key === "Escape" && this._open) {
        ev.stopPropagation();
        this.close();
      }
    };
  }

  static getConfigElement() {
    return document.createElement("expander-child-editor");
  }

  static getStubConfig() {
    return { hash: "#popup", title: "My popup", card: { type: "entities", entities: [] } };
  }

  setConfig(config) {
    if (!config || !config.hash) {
      throw new Error("expander-child: 'hash' is required (e.g. hash: '#garage').");
    }
    this._config = config;
    this._hash = normHash(config.hash);
    this._built = false;
    this._build();
    this._buildContent();
    this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._contentEl) this._contentEl.hass = hass;
  }

  connectedCallback() {
    window.addEventListener("location-changed", this._onLocationChange);
    window.addEventListener("popstate", this._onLocationChange);
    window.addEventListener("hashchange", this._onLocationChange);
    document.addEventListener("keydown", this._onKeyDown);
    this._sync();
  }

  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onLocationChange);
    window.removeEventListener("popstate", this._onLocationChange);
    window.removeEventListener("hashchange", this._onLocationChange);
    document.removeEventListener("keydown", this._onKeyDown);
  }

  _build() {
    if (this._built) return;
    // `placeholder` (default true) shows a faint inline marker so the card stays
    // selectable in the dashboard editor. Set it false for production to make
    // the child take no space at all until opened.
    const showPlaceholder = this._config.placeholder !== false;
    const w = this._config.width || "540px";
    const width = /^\d+$/.test(String(w)) ? `${w}px` : w;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: ${showPlaceholder ? "block" : "contents"}; }
        .placeholder {
          display: ${showPlaceholder ? "flex" : "none"};
          align-items: center; gap: 8px;
          padding: 8px 12px;
          border: 1px dashed var(--divider-color, #9e9e9e);
          border-radius: 10px;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }
        .backdrop {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(2px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.25s ease;
          z-index: 8;
        }
        .sheet {
          position: fixed; left: 50%; bottom: 0;
          transform: translate(-50%, 100%);
          width: min(${width}, 96vw);
          max-height: 86vh;
          display: flex; flex-direction: column;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: var(--ha-card-border-radius, 28px) var(--ha-card-border-radius, 28px) 0 0;
          box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.35);
          transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
          z-index: 9; overflow: hidden;
        }
        :host([data-open]) .backdrop { opacity: 1; pointer-events: auto; }
        :host([data-open]) .sheet { transform: translate(-50%, 0); }
        .header { display: flex; align-items: center; gap: 8px; padding: 14px 16px 8px; }
        .header .title { font-size: 1.3rem; font-weight: 600; flex: 1; }
        .header ha-icon-button { --mdc-icon-button-size: 40px; color: var(--secondary-text-color); }
        .body { padding: 8px 16px 24px; overflow-y: auto; }
      </style>

      <div class="placeholder">⤵ expander-child → ${this._hash} (opens on ${this._hash})</div>

      <div class="backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="header">
          <div class="title">${this._config.title || ""}</div>
          <ha-icon-button class="close" label="Close"></ha-icon-button>
        </div>
        <div class="body"></div>
      </div>
    `;

    this._backdrop = this.shadowRoot.querySelector(".backdrop");
    this._bodyEl = this.shadowRoot.querySelector(".body");
    const closeBtn = this.shadowRoot.querySelector(".close");
    if (closeBtn) closeBtn.path = MDI_CLOSE;
    this._backdrop.addEventListener("click", () => this.close());
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    this._built = true;
  }

  async _buildContent() {
    const cfg =
      this._config.card ||
      (Array.isArray(this._config.cards)
        ? { type: "vertical-stack", cards: this._config.cards }
        : null);
    if (!this._bodyEl) return;
    this._bodyEl.innerHTML = "";
    this._contentEl = null;
    if (!cfg) return;
    try {
      const helpers = await window.loadCardHelpers();
      const el = helpers.createCardElement(cfg);
      if (this._hass) el.hass = this._hass;
      this._contentEl = el;
      this._bodyEl.appendChild(el);
    } catch (e) {
      const err = document.createElement("div");
      err.textContent = `expander-child: ${e && e.message ? e.message : e}`;
      err.style.color = "var(--error-color, red)";
      this._bodyEl.appendChild(err);
    }
  }

  _isHashActive() {
    return window.location.hash === this._hash;
  }

  open() {
    openHash(this._hash);
    this._sync();
  }

  close() {
    if (this._isHashActive()) {
      window.history.back();
    } else {
      this._setOpen(false);
    }
  }

  _sync() {
    this._setOpen(this._isHashActive());
  }

  _setOpen(open) {
    if (open === this._open) return;
    this._open = open;
    if (open) this.setAttribute("data-open", "");
    else this.removeAttribute("data-open");
  }

  getCardSize() {
    return this._config && this._config.placeholder !== false ? 1 : 0;
  }
}

if (!customElements.get("expander-child")) {
  customElements.define("expander-child", ExpanderChild);
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

const HEADER_SCHEMA = [
  { name: "hash", selector: { text: {} } },
  { name: "title", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];
const HEADER_LABELS = {
  hash: "Hash to open (e.g. #garage) — must match the child",
  title: "Title",
  icon: "Icon",
};

class ExpanderHeaderEditor extends HTMLElement {
  setConfig(config) {
    this._config = { hash: "#popup", ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
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
  _render() {
    if (this._form) {
      this._form.data = this._config;
      return;
    }
    this.innerHTML = "";
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    form.schema = HEADER_SCHEMA;
    form.computeLabel = (s) => HEADER_LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this._emit();
    });
    this._form = form;
    this.appendChild(form);
  }
}
if (!customElements.get("expander-header-editor")) {
  customElements.define("expander-header-editor", ExpanderHeaderEditor);
}

const CHILD_SCHEMA = [
  { name: "hash", selector: { text: {} } },
  { name: "title", selector: { text: {} } },
  { name: "width", selector: { text: {} } },
  { name: "placeholder", selector: { boolean: {} } },
];
const CHILD_LABELS = {
  hash: "Hash that opens it (e.g. #garage) — must match the header",
  title: "Title (shown at the top of the popup)",
  width: "Width (e.g. 540px — optional)",
  placeholder: "Show a placeholder in the dashboard (easier to edit)",
};

class ExpanderChildEditor extends HTMLElement {
  setConfig(config) {
    this._config = { hash: "#popup", placeholder: true, ...config };
    this._render();
    this._ensureNativeEditors();
  }
  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
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
  _iconButton(path, label, onClick) {
    const b = document.createElement("ha-icon-button");
    b.path = path;
    b.label = label;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onClick();
    });
    return b;
  }
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
  _formData() {
    return {
      hash: this._config.hash || "",
      title: this._config.title || "",
      width: this._config.width || "",
      placeholder: this._config.placeholder !== false,
    };
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
    form.schema = CHILD_SCHEMA;
    form.computeLabel = (s) => CHILD_LABELS[s.name] || s.name;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this._emit();
    });
    this._form = form;
    root.appendChild(form);

    root.appendChild(
      this._section(
        "Content card",
        "Edited like a normal card. For several cards, use a vertical-stack here."
      )
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
    const card = this._config.card;
    const hasCard = !!(card && card.type);

    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.justifyContent = "flex-end";
    bar.style.gap = "4px";
    bar.appendChild(
      this._iconButton(
        MDI_CODE_BRACES,
        this._cardYaml ? "Edit in the visual editor" : "Edit in YAML",
        () => {
          this._cardYaml = !this._cardYaml;
          this._renderCardEditor();
        }
      )
    );
    if (hasCard) {
      bar.appendChild(
        this._iconButton(MDI_DELETE, "Remove content card", () => {
          this._config = { ...this._config };
          delete this._config.card;
          this._emit();
          this._cardYaml = false;
          this._renderCardEditor();
        })
      );
    }
    c.appendChild(bar);

    if (this._cardYaml) {
      this._cardEd = this._makeObjectEditor(this._config.card || {}, (v) => {
        this._config = { ...this._config, card: v };
        this._emit();
      });
      c.appendChild(this._cardEd);
      return;
    }

    if (hasCard && this._hasNativeEditor) {
      const ed = document.createElement("hui-card-element-editor");
      ed.hass = this._hass;
      ed.lovelace = this._lovelace;
      ed.value = card;
      ed.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        this._config = { ...this._config, card: ev.detail.config };
        this._emit();
      });
      this._cardEd = ed;
      c.appendChild(ed);
    } else if (!hasCard && customElements.get("hui-card-picker")) {
      const picker = document.createElement("hui-card-picker");
      picker.hass = this._hass;
      picker.lovelace = this._lovelace;
      picker.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        this._config = { ...this._config, card: ev.detail.config };
        this._emit();
        this._renderCardEditor();
      });
      this._cardEd = picker;
      c.appendChild(picker);
    } else {
      this._cardEd = this._makeObjectEditor(this._config.card || {}, (v) => {
        this._config = { ...this._config, card: v };
        this._emit();
      });
      c.appendChild(this._cardEd);
    }
  }
}
if (!customElements.get("expander-child-editor")) {
  customElements.define("expander-child-editor", ExpanderChildEditor);
}

window.customCards = window.customCards || [];
[
  {
    type: "expander-header",
    name: "Expander Header",
    description: "The visible button. Tap it to open the matching Expander Child popup (by #hash).",
  },
  {
    type: "expander-child",
    name: "Expander Child",
    description:
      "The popup content (Bubble Card style). Hidden until its #hash is open; its content is a normal card.",
  },
].forEach((c) => {
  if (!window.customCards.some((x) => x.type === c.type)) {
    window.customCards.push({
      ...c,
      preview: false,
      documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
    });
  }
});

console.info(
  `%c expander-pair %c v${VERSION} `,
  "color:#fff;background:#506eac;border-radius:3px 0 0 3px",
  "color:#506eac;background:#fff;border-radius:0 3px 3px 0"
);
