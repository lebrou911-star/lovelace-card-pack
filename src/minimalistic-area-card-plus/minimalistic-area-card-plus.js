/**
 * Minimalistic Area Card Plus — part of lovelace-card-pack.
 *
 * A fork of "Minimalistic Area Card" by Marcos Junior (junalmeida):
 *   https://github.com/junalmeida/homeassistant-minimalistic-area-card
 * Original work Copyright (c) 2020 Custom cards for Home Assistant, MIT licensed.
 * This fork is also MIT licensed (see LICENSE in this repo).
 *
 * Differences from upstream:
 *   - Element renamed to <minimalistic-area-card-plus> to avoid clashing with a
 *     separate install of the original card.
 *   - Reimplemented as dependency-free vanilla JS (no lit / custom-card-helpers)
 *     so it bundles cleanly into the pack.
 *   - Adds a full visual editor (see editor.js).
 *   - Adds alignment controls for the bottom sensor row so text-valued states
 *     (e.g. "idle") stay aligned next to numeric ones.
 */

import { MinimalisticAreaCardPlusEditor } from "./editor.js";

const VERSION = typeof __PACK_VERSION__ !== "undefined" ? __PACK_VERSION__ : "dev";
const CARD_TYPE = "minimalistic-area-card-plus";
const EDITOR_TYPE = "minimalistic-area-card-plus-editor";

const UNAVAILABLE = "unavailable";
const STATES_OFF = ["closed", "locked", "off", UNAVAILABLE, "idle", "disconnected", "standby"];
const SENSORS = ["sensor", "binary_sensor"];
const DOMAINS_TOGGLE = ["fan", "input_boolean", "light", "switch", "group", "automation", "humidifier"];

// Map the editor's friendly alignment options to CSS values.
const ITEM_ALIGN = { top: "flex-start", middle: "center", bottom: "flex-end", baseline: "baseline" };
const VALUE_JUSTIFY = { start: "flex-start", center: "center", end: "flex-end" };

/* ----------------------------------------------------------------------- */
/* Small helpers (replacing custom-card-helpers)                            */
/* ----------------------------------------------------------------------- */

function fireEvent(node, type, detail) {
  const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
  event.detail = detail || {};
  node.dispatchEvent(event);
  return event;
}

function hasAction(config) {
  return config !== undefined && config.action !== "none";
}

// Perform a Lovelace action (tap/hold/double-tap) without custom-card-helpers.
function handleAction(node, hass, actionConfig, fallbackEntityId) {
  if (!actionConfig) return;
  const action = actionConfig.action || "more-info";
  if (action === "none") return;

  // Optional confirmation, like native HA: tap_action: { confirmation: { text, exemptions } }.
  if (actionConfig.confirmation) {
    const c = actionConfig.confirmation === true ? {} : actionConfig.confirmation;
    const exempt =
      Array.isArray(c.exemptions) &&
      hass &&
      hass.user &&
      c.exemptions.some((e) => e && e.user === hass.user.id);
    if (!exempt && !window.confirm(c.text || "Are you sure you want to perform this action?")) {
      return;
    }
  }

  switch (action) {
    case "none":
      break;
    case "more-info": {
      const entityId = actionConfig.entity || fallbackEntityId;
      if (entityId) fireEvent(node, "hass-more-info", { entityId });
      break;
    }
    case "navigate": {
      if (!actionConfig.navigation_path) return;
      history.pushState(null, "", actionConfig.navigation_path);
      fireEvent(window, "location-changed", { replace: false });
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

// Attach tap / hold / double-tap detection to an element.
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

/* ----------------------------------------------------------------------- */
/* The card                                                                 */
/* ----------------------------------------------------------------------- */

class MinimalisticAreaCardPlus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = undefined;
    this._hass = undefined;
    this._area = undefined;
    this._areaEntities = undefined;
    this._built = false;
    // Live Jinja template subscriptions: template string -> { result, unsub, subscribed }.
    this._tpl = new Map();
  }

  disconnectedCallback() {
    this._clearTemplates();
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
    };
    if (firstArea) config.area = firstArea.area_id;
    return config;
  }

  setConfig(config) {
    if (!config || (config.entities && !Array.isArray(config.entities))) {
      throw new Error("Invalid configuration");
    }
    this._config = { hold_action: { action: "more-info" }, ...config };
    this._built = false;
    // Drop subscriptions tied to the previous config; the next render re-subscribes
    // only the templates the new config actually references.
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
    this._area = undefined;
    this._areaEntities = undefined;
    if (!hass || !this._config || !this._config.area) return;
    const area = hass.areas && hass.areas[this._config.area];
    if (area) {
      this._area = area;
      this._areaEntities = MinimalisticAreaCardPlus._findAreaEntities(hass, area.area_id);
    }
  }

  static _findAreaEntities(hass, areaId) {
    if (!hass.entities) return [];
    return Object.keys(hass.entities).filter((e) => {
      const ent = hass.entities[e];
      return (
        !ent.disabled_by &&
        !ent.hidden &&
        ent.entity_category !== "diagnostic" &&
        ent.entity_category !== "config" &&
        (ent.area_id === areaId || (ent.device_id && hass.devices[ent.device_id]?.area_id === areaId))
      );
    });
  }

  _parseEntity(item) {
    return typeof item === "string" ? { entity: item } : item;
  }

  _classifyEntities() {
    const sensor = [];
    // Actionable entities keep their original config order (the `dialog` flag
    // only selects the default tap action). The upstream card split these into
    // dialog-then-toggle groups, which ignored the user's ordering.
    const buttons = [];
    const entities = (this._config && this._config.entities) || this._areaEntities || [];
    for (const item of entities) {
      const entity = this._parseEntity(item);
      if (!entity) continue;
      if (!entity.entity) {
        // Entity-less shortcut button: a plain icon + action (e.g. a
        // navigation link to Config / Logs / HACS). Rendered in the action row.
        if (entity.icon || entity.tap_action) buttons.push({ conf: entity, dialog: false, button: true });
        continue;
      }
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
    if (!MinimalisticAreaCardPlus._isTemplate(value)) return value;
    this._subscribeTemplate(value);
    const entry = this._tpl.get(value);
    return entry && entry.result !== undefined ? entry.result : "";
  }

  _subscribeTemplate(str) {
    let entry = this._tpl.get(str);
    if (!entry) {
      entry = { result: undefined, unsub: null, subscribed: false };
      this._tpl.set(str, entry);
    }
    if (entry.subscribed || !this._hass || !this._hass.connection) return;
    entry.subscribed = true;
    this._hass.connection
      .subscribeMessage(
        (msg) => {
          entry.result = msg.result;
          this._render();
        },
        { type: "render_template", template: str, report_errors: true }
      )
      .then((unsub) => {
        entry.unsub = unsub;
      })
      .catch(() => {
        // Allow a later render to retry (e.g. connection not ready yet).
        entry.subscribed = false;
      });
  }

  _clearTemplates() {
    for (const entry of this._tpl.values()) {
      if (typeof entry.unsub === "function") {
        try {
          entry.unsub();
        } catch (_e) {
          /* ignore */
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
    // Area picture / config-driven look may also depend on areas.
    if (this._config.area && oldHass.areas !== this._hass.areas) return true;
    return false;
  }

  /* ----- rendering ----- */

  _render() {
    if (!this._config || !this._hass) return;
    this._setArea();

    if (!this._built) {
      this.shadowRoot.innerHTML = `<style>${MinimalisticAreaCardPlus.styles}</style>`;
      this._card = document.createElement("ha-card");
      this._card.tabIndex = hasAction(this._config.tap_action) ? 0 : -1;
      attachAction(
        this._card,
        { hasHold: hasAction(this._config.hold_action), hasDoubleClick: hasAction(this._config.double_tap_action) },
        (actionName) => this._handleThisAction(actionName)
      );
      // Fallback for browsers without `overflow: clip`: if focusing an icon
      // (e.g. when a more-info dialog closes) scrolls the card, snap it back.
      this._card.addEventListener("scroll", () => {
        if (this._card.scrollTop || this._card.scrollLeft) {
          this._card.scrollTop = 0;
          this._card.scrollLeft = 0;
        }
      });
      this.shadowRoot.appendChild(this._card);
      this._built = true;
    }

    const cfg = this._config;
    const hass = this._hass;

    // Background colour (template-aware)
    this._card.style.backgroundColor = this._resolve(cfg.background_color) || "";

    // Resolve background image / camera (image may be a template, e.g. day/night)
    const configImage = this._resolve(cfg.image);
    let imageUrl;
    if (!cfg.camera_image && (configImage || this._area?.picture)) {
      try {
        const base = hass.auth?.data?.hassUrl || "";
        imageUrl = new URL(configImage || this._area.picture, base || window.location.origin).toString();
      } catch (_e) {
        imageUrl = configImage || this._area?.picture;
      }
    }

    const { sensor, buttons } = this._classifyEntities();

    // Alignment options (the "plus" feature).
    const itemAlign = ITEM_ALIGN[cfg.item_align] || ITEM_ALIGN.middle;
    const valueJustify = VALUE_JUSTIFY[cfg.value_justify] || VALUE_JUSTIFY.start;
    const valueWrap = cfg.value_wrap === "nowrap";
    const valueMinWidth = Number(cfg.value_min_width) > 0 ? `${Number(cfg.value_min_width)}px` : "";
    const columns = Number(cfg.sensor_columns) > 0 ? Number(cfg.sensor_columns) : 0;

    // Build inner markup container fresh each render (cheap; card is small).
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
      // Fill and crop the tile like a static image does (object-fit: cover).
      huiImage.fitMode = "cover";
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
      // A bare number is treated as px; any other CSS length passes through.
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
    const hass = this._hass;
    const cfg = this._config;
    // Entity-less shortcut button (navigation / action only): no state-badge.
    if (!entityConf.entity) return this._renderButtonIcon(entityConf);
    const stateObj = hass.states[entityConf.entity];
    const entityReg = hass.entities ? hass.entities[entityConf.entity] : undefined;

    entityConf = {
      tap_action: { action: dialog ? "more-info" : "toggle" },
      hold_action: { action: "more-info" },
      show_state: entityConf.show_state === undefined ? true : !!entityConf.show_state,
      ...entityConf,
    };

    const unavailable = !stateObj || stateObj.state === UNAVAILABLE;
    if (unavailable && cfg.hide_unavailable) return null;
    if (unavailable) {
      const wrapper = document.createElement("div");
      wrapper.className = "wrapper";
      const warn = document.createElement("hui-warning-element");
      warn.label = `${entityConf.entity || "[empty]"} is unavailable`;
      if (cfg.shadow) warn.className = "shadow";
      wrapper.appendChild(warn);
      return wrapper;
    }

    const active = stateObj.state && STATES_OFF.indexOf(String(stateObj.state).toLowerCase()) === -1;
    // Name (template-aware) overrides the entity's friendly name for the tooltip.
    const resolvedName = this._resolve(entityConf.name);
    const friendly = resolvedName || stateObj.attributes?.friendly_name || stateObj.entity_id;

    // Per-entity overrides (each may be a Jinja template).
    const resolvedIcon = this._resolve(entityConf.icon);
    const resolvedColor = this._resolve(entityConf.color);

    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";
    if (isSensor && align && align.itemAlign) wrapper.style.alignItems = align.itemAlign;

    const iconButton = document.createElement("ha-icon-button");
    iconButton.className = active ? "state-on" : "";

    // Icon size as a percentage of the default look (100% = unchanged). The
    // sensor row keeps its smaller 0.67 baseline; the action row starts at 1.
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
      // A fixed/conditional colour wins over state-based colouring.
      badge.stateColor = false;
      badge.style.color = resolvedColor;
    } else {
      badge.stateColor =
        entityConf.state_color !== undefined
          ? entityConf.state_color
          : cfg.state_color !== undefined
          ? cfg.state_color
          : true;
    }
    if (cfg.shadow) badge.className = "shadow";

    // Wrap the icon so a badge/pill can be positioned over its top-right corner.
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

  // Render an entity-less shortcut button: a plain icon (ha-icon) with an
  // action, optional colour/size/badge — used for navigation links etc.
  _renderButtonIcon(entityConf) {
    const cfg = this._config;
    const resolvedIcon = this._resolve(entityConf.icon) || "mdi:gesture-tap-button";
    const resolvedName = this._resolve(entityConf.name);
    const resolvedColor = this._resolve(entityConf.color);

    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";

    const iconWrap = document.createElement("div");
    iconWrap.className = "icon-wrap";

    const iconButton = document.createElement("ha-icon-button");
    iconButton.className = "state-on";
    if (resolvedName) iconButton.title = resolvedName;

    const sizePct = Number(entityConf.icon_size != null ? entityConf.icon_size : cfg.icon_size);
    const factor = isFinite(sizePct) && sizePct > 0 ? sizePct / 100 : 1;
    if (factor !== 1) {
      iconButton.style.zoom = String(factor);
      iconButton.style.MozTransform = `scale(${factor})`;
    }

    const haIcon = document.createElement("ha-icon");
    haIcon.icon = resolvedIcon;
    if (cfg.shadow) haIcon.className = "shadow";
    if (resolvedColor) haIcon.style.color = resolvedColor;
    iconButton.appendChild(haIcon);
    iconWrap.appendChild(iconButton);

    const badgeEl = this._buildBadge(entityConf);
    if (badgeEl) iconWrap.appendChild(badgeEl);

    attachAction(
      iconButton,
      { hasHold: hasAction(entityConf.hold_action), hasDoubleClick: hasAction(entityConf.double_tap_action) },
      (actionName) => handleAction(this, this._hass, entityConf[`${actionName}_action`], undefined)
    );
    wrapper.appendChild(iconWrap);
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
    handleAction(this, this._hass, actionConfig, undefined);
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
      // Prefer HA's translated display when available.
      if (this._hass.formatEntityState) {
        try {
          return this._hass.formatEntityState(stateObj);
        } catch (_e) {
          /* fall through */
        }
      }
      return stateObj.state;
    }
    return null;
  }

  _formatNumber(value, stateObj, entityReg) {
    const precision = entityReg?.display_precision;
    const options = {};
    if (precision != null) {
      options.minimumFractionDigits = precision;
      options.maximumFractionDigits = precision;
    } else if (
      Number.isInteger(Number(stateObj.attributes?.step)) &&
      Number.isInteger(Number(stateObj.state))
    ) {
      options.maximumFractionDigits = 0;
    }
    const locale = this._hass.locale?.language || undefined;
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
        /* clip also blocks programmatic scrolling, so focusing an icon when a
           more-info dialog closes cannot nudge the card content out of place. */
        overflow: clip;
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
        display: block;
        width: 100%;
        height: 100%;
      }
      div.camera hui-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
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
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: flex-end;
        background-color: transparent;
        padding: 6px 4px 3px 0;
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
      .box .buttons ha-icon-button ha-icon { color: var(--ha-picture-icon-button-on-color, white); }
      .box .buttons ha-icon-button ha-icon.shadow { filter: drop-shadow(2px 2px 2px gray); }
      .box .sensors .state {
        display: inline-flex;
        align-items: center;
        /* Small gap from the icon. Was -9px, which glued the value to wide
           glyphs (e.g. mdi:pump); -6px keeps a minimum space for every icon. */
        margin-left: -6px;
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
}

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
    description:
      "Minimalistic area card with a visual editor and alignment controls for the bottom sensor row. Fork of junalmeida's Minimalistic Area Card.",
    preview: true,
    documentationURL: "https://github.com/lebrou911-star/lovelace-card-pack",
  });
}

console.info(
  `%c MINIMALISTIC-AREA-CARD-PLUS %c v${VERSION} `,
  "color: white; background: #ea580c; font-weight: 700;",
  "color: #ea580c; background: white; font-weight: 700;"
);

export { MinimalisticAreaCardPlus };
