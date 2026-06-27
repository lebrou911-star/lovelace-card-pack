/**
 * Expander Child — hidden content that reveals INLINE (accordion) when a URL
 * hash is active, like the original expander (not an overlay).
 *
 * Part of lovelace-card-pack. Registers <expander-child> and its visual editor
 * <expander-child-editor>. The card sits collapsed in the dashboard; when the
 * URL hash matches its `hash` (e.g. #garage) it expands in place, pushing the
 * cards below it down. Any card opens it with `tap_action: navigate` to that
 * hash — so the trigger is just a normal (styled) card, e.g. a
 * minimalistic-area-card-plus. Tapping the trigger again toggles it shut; the
 * collapse bar (▲), the browser Back button, and Escape also collapse it.
 *
 * Its content is a `cards: []` list, edited exactly like a stack.
 *
 * Self-contained vanilla JS module imported for its side effects by src/index.js.
 *
 * License: MIT
 */
const VERSION = "0.6.0";

const MDI_CHEVRON_UP = "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z";

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
// <expander-child> — the hidden, inline-revealing content
// ---------------------------------------------------------------------------

class ExpanderChild extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = false;
    this._contentEl = null;
    this._built = false;
    this._onNav = () => {
      this._handleNav();
      this._updatePlaceholder();
    };
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
    this._setOpen(this._isHashActive());
  }

  set hass(hass) {
    this._hass = hass;
    if (this._contentEl) this._contentEl.hass = hass;
  }

  connectedCallback() {
    window.addEventListener("location-changed", this._onNav);
    window.addEventListener("popstate", this._onNav);
    window.addEventListener("hashchange", this._onNav);
    document.addEventListener("keydown", this._onKeyDown);
    // Debounce window so HA's initial location events right after mount don't
    // count as a "re-tap" and toggle us shut on load.
    this._navTs = Date.now();
    this._setOpen(this._isHashActive());
    this._updatePlaceholder();
  }

  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onNav);
    window.removeEventListener("popstate", this._onNav);
    window.removeEventListener("hashchange", this._onNav);
    document.removeEventListener("keydown", this._onKeyDown);
  }

  _build() {
    if (this._built) return;
    const hideHeader = this._config.show_header === false;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        /* The collapsed marker is only shown while editing the dashboard (see
           _updatePlaceholder) — never in normal/deployed view. */
        .placeholder {
          display: none;
          align-items: center; gap: 8px;
          padding: 8px 12px;
          border: 1px dashed var(--divider-color, #9e9e9e);
          border-radius: 10px;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }

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
    this._placeholderEl = this.shadowRoot.querySelector(".placeholder");
    const chev = this.shadowRoot.querySelector(".chev");
    if (chev) chev.path = MDI_CHEVRON_UP;
    const closebar = this.shadowRoot.querySelector(".closebar");
    if (closebar) closebar.addEventListener("click", () => this.close());
    this._built = true;
    this._updatePlaceholder();
  }

  // Storage dashboards add `?edit=1` to the URL while in edit mode.
  _isEditMode() {
    return /[?&]edit=1\b/.test(window.location.search);
  }

  // Show the dashed marker only while editing (so the card is selectable) and
  // only when collapsed — never in normal view.
  _updatePlaceholder() {
    if (!this._placeholderEl) return;
    const show = this._config.placeholder !== false && !this._open && this._isEditMode();
    this._placeholderEl.style.display = show ? "flex" : "none";
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
  }

  // Toggle on navigation to our hash; collapse on navigation away. A short
  // debounce absorbs the burst of location-changed + hashchange that a single
  // navigation fires, so one tap = one toggle (no flicker).
  _handleNav() {
    if (!this._isHashActive()) {
      this._setOpen(false);
      return;
    }
    const now = Date.now();
    if (now - (this._navTs || 0) < 250) return;
    this._navTs = now;
    if (this._open) {
      this._setOpen(false);
      this._clearHash();
    } else {
      this._setOpen(true);
    }
  }

  // Drop our hash from the URL without adding a history entry or firing events.
  _clearHash() {
    if (!this._isHashActive()) return;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    );
  }

  close() {
    this._setOpen(false);
    this._clearHash();
  }

  _setOpen(open) {
    if (open === this._open) return;
    this._open = open;
    if (open) this.setAttribute("data-open", "");
    else this.removeAttribute("data-open");
    this._updatePlaceholder();
  }

  getCardSize() {
    // Collapsed: takes essentially no space. Open: let the content speak.
    return this._open ? 3 : 0;
  }
}

if (!customElements.get("expander-child")) {
  customElements.define("expander-child", ExpanderChild);
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

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
  placeholder: "Show a selectable marker while editing (hidden in normal view)",
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
if (!window.customCards.some((x) => x.type === "expander-child")) {
  window.customCards.push({
    type: "expander-child",
    name: "Expander Child",
    description:
      "Hidden content that reveals inline (accordion) when its #hash is active — opened by any card's tap_action: navigate. Edited like a stack.",
    preview: false,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
  });
}

console.info(
  `%c expander-pair %c v${VERSION} `,
  "color:#fff;background:#506eac;border-radius:3px 0 0 3px",
  "color:#506eac;background:#fff;border-radius:0 3px 3px 0"
);
