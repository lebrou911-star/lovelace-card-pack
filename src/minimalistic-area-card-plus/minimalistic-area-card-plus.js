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
    const dialog = [];
    const toggle = [];
    const sensor = [];
    const entities = (this._config && this._config.entities) || this._areaEntities || [];
    for (const item of entities) {
      const entity = this._parseEntity(item);
      if (!entity || !entity.entity) continue;
      const domain = entity.entity.split(".")[0];
      if (SENSORS.indexOf(domain) !== -1 || entity.attribute) {
        sensor.push(entity);
      } else if (this._config.force_dialog || DOMAINS_TOGGLE.indexOf(domain) === -1) {
        dialog.push(entity);
      } else {
        toggle.push(entity);
      }
    }
    return { dialog, toggle, sensor };
  }

  _shouldUpdate(oldHass) {
    if (!oldHass) return true;
    if (oldHass.themes !== this._hass.themes || oldHass.locale !== this._hass.locale) return true;
    this._setArea();
    const { dialog, toggle, sensor } = this._classifyEntities();
    for (const e of [...dialog, ...toggle, ...sensor]) {
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
      this.shadowRoot.appendChild(this._card);
      this._built = true;
    }

    const cfg = this._config;
    const hass = this._hass;

    // Background colour
    this._card.style.backgroundColor = cfg.background_color || "";

    // Resolve background image / camera
    let imageUrl;
    if (!cfg.camera_image && (cfg.image || this._area?.picture)) {
      try {
        const base = hass.auth?.data?.hassUrl || "";
        imageUrl = new URL(cfg.image || this._area.picture, base || window.location.origin).toString();
      } catch (_e) {
        imageUrl = cfg.image || this._area?.picture;
      }
    }

    const { dialog, toggle, sensor } = this._classifyEntities();

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
      huiImage.width = "100%";
      camera.appendChild(huiImage);
      this._card.appendChild(camera);
    }

    const box = document.createElement("div");
    box.className = "box";

    const header = document.createElement("div");
    header.className = "card-header";
    header.textContent = cfg.title || "";
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

    const buttons = document.createElement("div");
    buttons.className = "buttons";
    dialog.forEach((conf) => {
      const node = this._renderEntity(conf, true, false, {});
      if (node) buttons.appendChild(node);
    });
    toggle.forEach((conf) => {
      const node = this._renderEntity(conf, false, false, {});
      if (node) buttons.appendChild(node);
    });
    box.appendChild(buttons);

    this._card.appendChild(box);
  }

  _renderEntity(entityConf, dialog, isSensor, align) {
    const hass = this._hass;
    const cfg = this._config;
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
    const friendly = stateObj.attributes?.friendly_name || stateObj.entity_id;

    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";
    if (isSensor && align && align.itemAlign) wrapper.style.alignItems = align.itemAlign;

    const iconButton = document.createElement("ha-icon-button");
    iconButton.className = active ? "state-on" : "";
    const badge = document.createElement("state-badge");
    badge.hass = hass;
    badge.stateObj = stateObj;
    badge.title = friendly;
    if (entityConf.icon) badge.overrideIcon = entityConf.icon;
    badge.stateColor =
      entityConf.state_color !== undefined
        ? entityConf.state_color
        : cfg.state_color !== undefined
        ? cfg.state_color
        : true;
    if (cfg.shadow) badge.className = "shadow";
    iconButton.appendChild(badge);

    attachAction(
      iconButton,
      { hasHold: hasAction(entityConf.hold_action), hasDoubleClick: hasAction(entityConf.double_tap_action) },
      (actionName) => {
        const actionConfig = entityConf[`${actionName}_action`];
        handleAction(this, hass, actionConfig, entityConf.entity);
      }
    );
    wrapper.appendChild(iconButton);

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
        -moz-transform: scale(0.67);
        zoom: 0.67;
        vertical-align: middle;
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
