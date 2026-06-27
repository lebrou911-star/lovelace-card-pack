/**
 * Expander pair — two separate cards that together behave like a Bubble Card
 * pop-up, kept apart on purpose to avoid confusion:
 *
 *   • <expander-header>  the always-visible button. Tapping it opens the popup
 *                        by navigating to a URL hash (e.g. #garage).
 *   • <expander-child>   the hidden content. Collapsed until the URL hash matches
 *                        its `hash`; then it reveals INLINE (accordion) right
 *                        where it sits, pushing the cards below it down — like
 *                        the original expander, not an overlay. Its content is a
 *                        `cards: []` list, edited exactly like a stack.
 *
 * Link the two by giving them the same `hash`. The collapse bar (▲), the browser
 * Back button, or Escape collapses the child.
 *
 * Self-contained vanilla JS module imported for its side effects by src/index.js.
 *
 * License: MIT
 */
const VERSION = "0.4.0";

const MDI_CHEVRON_RIGHT = "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z";
const MDI_CHEVRON_UP = "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z";
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
    return { hash: "#popup", title: "My popup", cards: [{ type: "entities", entities: [] }] };
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
    // `placeholder` (default true) shows a faint inline marker when collapsed so
    // the card stays selectable in the dashboard editor. Set it false to leave
    // no trace at all until opened.
    const showPlaceholder = this._config.placeholder !== false;
    const hideHeader = this._config.show_header === false;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .placeholder {
          display: ${showPlaceholder ? "flex" : "none"};
          align-items: center; gap: 8px;
          padding: 8px 12px;
          border: 1px dashed var(--divider-color, #9e9e9e);
          border-radius: 10px;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }
        :host([data-open]) .placeholder { display: none; }

        /* Inline accordion: animate height via grid-template-rows 0fr -> 1fr,
           so opening pushes the cards below it down (no overlay). */
        .wrap {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s ease;
        }
        :host([data-open]) .wrap { grid-template-rows: 1fr; }
        .inner { overflow: hidden; min-height: 0; }
        .panel { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
        .closebar {
          display: ${hideHeader ? "none" : "flex"};
          align-items: center; justify-content: space-between;
          padding: 4px 4px 0; cursor: pointer;
        }
        .closebar .t { font-weight: 600; color: var(--primary-text-color); }
        .closebar ha-svg-icon { color: var(--secondary-text-color); --mdc-icon-size: 22px; }
        .body { display: block; }
      </style>

      <div class="placeholder">⤵ expander-child → ${this._hash} (s'insère ici quand ${this._hash} est actif)</div>

      <div class="wrap"><div class="inner">
        <div class="panel">
          <div class="closebar" title="Réduire">
            <span class="t">${this._config.title || ""}</span>
            <ha-svg-icon class="chev"></ha-svg-icon>
          </div>
          <div class="body"></div>
        </div>
      </div></div>
    `;

    this._bodyEl = this.shadowRoot.querySelector(".body");
    const chev = this.shadowRoot.querySelector(".chev");
    if (chev) chev.path = MDI_CHEVRON_UP;
    const closebar = this.shadowRoot.querySelector(".closebar");
    if (closebar) closebar.addEventListener("click", () => this.close());
    this._built = true;
  }

  async _buildContent() {
    const cards = Array.isArray(this._config.cards)
      ? this._config.cards
      : this._config.card
      ? [this._config.card]
      : [];
    const cfg = cards.length ? { type: "vertical-stack", cards } : null;
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
  { name: "show_header", selector: { boolean: {} } },
  { name: "placeholder", selector: { boolean: {} } },
];
const CHILD_LABELS = {
  hash: "Hash that reveals it (e.g. #garage) — must match the trigger",
  title: "Title (shown on the collapse bar)",
  show_header: "Show the collapse bar (title + ▲ to close)",
  placeholder: "Show a placeholder when collapsed (easier to edit)",
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
      show_header: this._config.show_header !== false,
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
        "Content",
        "Edited exactly like a stack — add cards, pick a type, edit one at a time."
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
    const cards = Array.isArray(this._config.cards)
      ? this._config.cards
      : this._config.card
      ? [this._config.card]
      : [];

    // Edit the popup content exactly like a stack: HA's native card editor on a
    // vertical-stack gives the add / pick-type / edit-one-at-a-time UI with the
    // collapsed ("Content is hidden…") sub-cards — same as editing any stack.
    if (this._hasNativeEditor) {
      const ed = document.createElement("hui-card-element-editor");
      ed.hass = this._hass;
      ed.lovelace = this._lovelace;
      ed.value = { type: "vertical-stack", cards };
      ed.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const v = ev.detail.config || {};
        this._config = { ...this._config, cards: Array.isArray(v.cards) ? v.cards : [] };
        delete this._config.card; // migrate any legacy single-card content
        this._emit();
      });
      this._cardEd = ed;
      c.appendChild(ed);
      return;
    }

    // YAML fallback: edit the cards array directly.
    this._cardEd = this._makeObjectEditor(cards, (v) => {
      this._config = { ...this._config, cards: Array.isArray(v) ? v : [] };
      delete this._config.card;
      this._emit();
    });
    c.appendChild(this._cardEd);
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
      "Hidden content that reveals inline (accordion) when its #hash is active. Edited like a stack.",
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
