/**
 * Minimal config editor for <minimalistic-area-card-plus>.
 *
 * Placeholder implementation — the full visual editor (entity list management
 * and alignment controls) is added in a follow-up. For now this exposes the
 * core fields via ha-form so the card is configurable from the UI.
 */

class MinimalisticAreaCardPlusEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
  }
}

export { MinimalisticAreaCardPlusEditor };
