// ============================================================
//  Govee Cloud API – Enhetskontroll via Govee Developer API
//  Fil: server/bridges/govee.js
//
//  Stöder både Govees äldre Developer API (v1) och deras
//  nyare OpenAPI (openapi.api.govee.com v1) beroende på nyckel.
// ============================================================

export class GoveeBridge {
  constructor({ apiKey }) {
    if (!apiKey) {
      this.enabled = false
      console.warn('⚠️  Govee: GOVEE_API_KEY saknas i runtimeConfig')
      return
    }
    this.enabled = true
    this.apiKey  = apiKey
    console.log('🌈 Govee Cloud API initierad (dubbla API-lägen stöds)')
  }

  // ── OpenAPI v1 Metoder (Nya) ──────────────────────────────
  async #getDeviceStateOpenAPI(device) {
    const requestId = Math.random().toString(36).substring(2, 15)
    const res = await fetch('https://openapi.api.govee.com/v1/devices/state', {
      method: 'POST',
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        payload: {
          sku: device.govee_model,
          device: device.bridge_id
        }
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Govee OpenAPI fel: ${JSON.stringify(data)}`)
    
    const capabilities = data.payload?.capabilities ?? []
    const onOffCap = capabilities.find(c => c.instance === 'powerState')
    const brightnessCap = capabilities.find(c => c.instance === 'brightness')
    const colorCap = capabilities.find(c => c.instance === 'colorRgb')

    const rgbVal = colorCap?.state?.value
    let colorAttr = null
    if (rgbVal !== undefined && rgbVal !== null) {
      const r = (rgbVal >> 16) & 255
      const g = (rgbVal >> 8) & 255
      const b = rgbVal & 255
      colorAttr = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    return {
      entity_id: device.entity_id,
      state: onOffCap?.state?.value === 1 ? 'on' : 'off',
      attributes: {
        brightness: brightnessCap?.state?.value ? Math.round((brightnessCap.state.value / 100) * 255) : 128,
        friendly_name: device.name,
        ...(colorAttr && { color: colorAttr }),
      },
    }
  }

  async #sendCommandOpenAPI(device, type, instance, value) {
    const requestId = Math.random().toString(36).substring(2, 15)
    const res = await fetch('https://openapi.api.govee.com/v1/devices/control', {
      method: 'PUT',
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        payload: {
          sku: device.govee_model,
          device: device.bridge_id,
          capability: { type, instance, value }
        }
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Govee OpenAPI control fel: ${JSON.stringify(data)}`)
  }

  // ── Legacy API v1 Metoder (Äldre) ─────────────────────────
  async #getDeviceStateLegacy(device) {
    const url = `https://developer-api.govee.com/v1/devices/state?device=${encodeURIComponent(device.bridge_id)}&model=${encodeURIComponent(device.govee_model)}`
    const res = await fetch(url, {
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Govee Legacy API fel: ${JSON.stringify(data)}`)

    // Legacy returnerar properties som en array av enkla objekt
    const props = Object.assign({}, ...(data.data?.properties ?? []))

    let colorAttr = null
    if (props.color) {
      const { r, g, b } = props.color
      colorAttr = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    return {
      entity_id: device.entity_id,
      state: props.powerState === 'on' ? 'on' : 'off',
      attributes: {
        brightness:    props.brightness ? Math.round((props.brightness / 100) * 255) : 128,
        friendly_name: device.name,
        ...(colorAttr && { color: colorAttr }),
      },
    }
  }

  async #sendCommandLegacy(device, name, value) {
    const res = await fetch('https://developer-api.govee.com/v1/devices/control', {
      method: 'PUT',
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device: device.bridge_id,
        model:  device.govee_model,
        cmd:    { name, value }
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Govee Legacy control fel: ${JSON.stringify(data)}`)
  }

  // ── Publika Bridge Metoder ────────────────────────────────
  async getStates(deviceConfigs) {
    if (!this.enabled) return []

    const results = await Promise.allSettled(
      deviceConfigs.map((d) => {
        const isNewAPI = d.govee_api_version === 'openapi'
        return isNewAPI ? this.#getDeviceStateOpenAPI(d) : this.#getDeviceStateLegacy(d)
      })
    )

    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)
  }

  async setLight(deviceConfig, changes) {
    if (!this.enabled) return

    const isNewAPI = deviceConfig.govee_api_version === 'openapi'
    const cmds = []

    if (isNewAPI) {
      if (changes.state !== undefined) {
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.on_off', 'powerState', changes.state === 'on' ? 1 : 0))
      }
      if (changes.brightness !== undefined) {
        const pct = Math.round((changes.brightness / 255) * 100)
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.range', 'brightness', pct))
      }
      if (changes.color_temp !== undefined) {
        const kelvin = Math.round(1_000_000 / changes.color_temp)
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.color_setting', 'colorTemperature', kelvin))
      }
      if (changes.color !== undefined) {
        const hex = changes.color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        const rgbVal = (r << 16) + (g << 8) + b
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.color_setting', 'colorRgb', rgbVal))
      }
    } else {
      if (changes.state !== undefined) {
        cmds.push(this.#sendCommandLegacy(deviceConfig, 'turn', changes.state))
      }
      if (changes.brightness !== undefined) {
        const goveeLevel = Math.round((changes.brightness / 255) * 100)
        cmds.push(this.#sendCommandLegacy(deviceConfig, 'brightness', goveeLevel))
      }
      if (changes.color_temp !== undefined) {
        const kelvin = Math.round(1_000_000 / changes.color_temp)
        cmds.push(this.#sendCommandLegacy(deviceConfig, 'colorTem', kelvin))
      }
      if (changes.color !== undefined) {
        const hex = changes.color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        cmds.push(this.#sendCommandLegacy(deviceConfig, 'color', { r, g, b }))
      }
    }

    const results = await Promise.allSettled(cmds)
    for (const r of results) {
      if (r.status === 'rejected') console.error('Govee setLight fel:', r.reason)
    }
  }

  // ── Polling ───────────────────────────────────────────────
  startRealtime(io, deviceConfigs, intervalMs = 30_000) {
    if (!this.enabled || deviceConfigs.length === 0) return

    const poll = async () => {
      const states = await this.getStates(deviceConfigs).catch(() => [])
      for (const s of states) {
        io.emit('state_changed', { entity_id: s.entity_id, state: s })
      }
    }

    poll()
    setInterval(poll, intervalMs)
    console.log(`🔄 Govee: Pollning aktiv var ${intervalMs / 1000}s`)
  }
}
