// ============================================================
//  Govee Cloud API – Enhetskontroll via Govee Developer API
//  Fil: server/bridges/govee.js
//
//  Stöder både Govees äldre Developer API (v1) och deras
//  nyare OpenAPI (openapi.api.govee.com v1) beroende på nyckel.
// ============================================================

import { readRuntimeConfig, writeRuntimeConfig } from '../runtimeConfig.js'

const normalizeMAC = (mac) => mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase()

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

  // ── Modellsökning / Caching (För bakåtkompatibilitet) ─────────
  async #ensureModel(device) {
    if (device.govee_model) return device.govee_model

    console.log(`🔍 Govee: Modell saknas för enhet ${device.bridge_id}, hämtar från Govee API...`)
    let sku = null

    try {
      // 1. Prova OpenAPI först
      const r = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
        headers: { 'Govee-API-Key': this.apiKey }
      })
      if (r.ok) {
        const body = await r.json()
        const devices = Array.isArray(body.data) ? body.data : (body.data?.devices ?? [])
        const match = devices.find((d) => normalizeMAC(d.device) === normalizeMAC(device.bridge_id))
        if (match && (match.sku || match.model)) {
          sku = match.sku || match.model
        }
      }

      // 2. Fallback till Legacy API
      if (!sku) {
        const rLegacy = await fetch('https://developer-api.govee.com/v1/devices', {
          headers: { 'Govee-API-Key': this.apiKey }
        })
        if (rLegacy.ok) {
          const bodyLegacy = await rLegacy.json()
          const devicesLegacy = bodyLegacy.data?.devices ?? []
          const match = devicesLegacy.find((d) => normalizeMAC(d.device) === normalizeMAC(device.bridge_id))
          if (match && (match.model || match.sku)) {
            sku = match.model || match.sku
          }
        }
      }

      if (sku) {
        console.log(`✅ Govee: Hittade modell "${sku}" för enhet ${device.bridge_id}`)
        device.govee_model = sku

        // Spara permanent i runtime-config.json
        try {
          const cfg = readRuntimeConfig()
          const lightIndex = cfg.lights?.findIndex((l) => l.bridge_id === device.bridge_id && l.bridge === 'govee')
          if (lightIndex !== -1 && lightIndex !== undefined) {
            cfg.lights[lightIndex].govee_model = sku
            writeRuntimeConfig(cfg)
            console.log(`💾 Govee: Modell "${sku}" sparad i runtime-config.json för ${device.bridge_id}`)
          }
        } catch (saveErr) {
          console.error('⚠️ Govee: Kunde inte spara modellen i konfigurationsfilen:', saveErr.message)
        }

        return sku
      }
    } catch (err) {
      console.error(`❌ Govee: Fel vid hämtning av modell för ${device.bridge_id}:`, err.message)
    }

    console.warn(`⚠️ Govee: Kunde inte hitta modell för ${device.bridge_id}, använder default 'H6008'`)
    return 'H6008'
  }

  // ── OpenAPI v1 Metoder (Nya) ──────────────────────────────
  async #getDeviceStateOpenAPI(device) {
    const model = await this.#ensureModel(device)
    const requestId = Math.random().toString(36).substring(2, 15)
    const res = await fetch('https://openapi.api.govee.com/router/api/v1/device/state', {
      method: 'POST',
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        payload: {
          sku: model,
          device: device.bridge_id
        }
      })
    })
    const text = await res.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (err) {
        data = { message: text }
      }
    }
    if (!res.ok || data.code !== 200) throw new Error(`Govee OpenAPI fel (status ${res.status}): ${JSON.stringify(data)}`)
    
    const capabilities = data.payload?.capabilities ?? []
    const onOffCap = capabilities.find(c => c.instance === 'powerSwitch')
    const brightnessCap = capabilities.find(c => c.instance === 'brightness')
    const colorCap = capabilities.find(c => c.instance === 'colorRgb')
    const colorTempCap = capabilities.find(c => c.instance === 'colorTemperatureK')

    const rgbVal = colorCap?.state?.value
    let colorAttr = null
    if (rgbVal !== undefined && rgbVal !== null && rgbVal !== '') {
      const r = (rgbVal >> 16) & 255
      const g = (rgbVal >> 8) & 255
      const b = rgbVal & 255
      colorAttr = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    } else if (colorCap) {
      colorAttr = '#ffffff'
    }

    let colorTempMired = null
    const kelvin = colorTempCap?.state?.value
    if (kelvin) {
      colorTempMired = Math.round(1_000_000 / kelvin)
    }

    const powerVal = onOffCap?.state?.value
    const isOn = powerVal === 1 || powerVal === 'on' || powerVal === true

    return {
      entity_id: device.entity_id,
      state: isOn ? 'on' : 'off',
      attributes: {
        brightness: brightnessCap?.state?.value ? Math.round((brightnessCap.state.value / 100) * 255) : 128,
        friendly_name: device.name,
        ...(colorAttr && { color: colorAttr }),
        ...(colorTempMired && { color_temp: colorTempMired })
      },
    }
  }

  async #sendCommandOpenAPI(device, type, instance, value) {
    const model = await this.#ensureModel(device)
    const requestId = Math.random().toString(36).substring(2, 15)
    const res = await fetch('https://openapi.api.govee.com/router/api/v1/device/control', {
      method: 'POST',
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        payload: {
          sku: model,
          device: device.bridge_id,
          capability: { type, instance, value }
        }
      })
    })
    const text = await res.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (err) {
        data = { message: text }
      }
    }
    if (!res.ok || data.code !== 200) throw new Error(`Govee OpenAPI control fel (status ${res.status}): ${JSON.stringify(data)}`)
  }

  // ── Legacy API v1 Metoder (Äldre) ─────────────────────────
  async #getDeviceStateLegacy(device) {
    const model = await this.#ensureModel(device)
    const url = `https://developer-api.govee.com/v1/devices/state?device=${encodeURIComponent(device.bridge_id)}&model=${encodeURIComponent(model)}`
    const res = await fetch(url, {
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' }
    })
    const text = await res.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (err) {
        data = { message: text }
      }
    }
    if (!res.ok || data.code !== 200) throw new Error(`Govee Legacy API fel (status ${res.status}): ${JSON.stringify(data)}`)

    // Legacy returnerar properties som en array av enkla objekt
    const props = Object.assign({}, ...(data.data?.properties ?? []))

    let colorAttr = null
    if (props.color && props.color.r !== undefined) {
      const { r, g, b } = props.color
      colorAttr = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    } else {
      colorAttr = '#ffffff'
    }

    let colorTempMired = null
    if (props.colorTem) {
      colorTempMired = Math.round(1_000_000 / props.colorTem)
    }

    return {
      entity_id: device.entity_id,
      state: props.powerState === 'on' ? 'on' : 'off',
      attributes: {
        brightness:    props.brightness ? Math.round((props.brightness / 100) * 255) : 128,
        friendly_name: device.name,
        ...(colorAttr && { color: colorAttr }),
        ...(colorTempMired && { color_temp: colorTempMired })
      },
    }
  }

  async #sendCommandLegacy(device, name, value) {
    const model = await this.#ensureModel(device)
    const res = await fetch('https://developer-api.govee.com/v1/devices/control', {
      method: 'PUT',
      headers: { 'Govee-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device: device.bridge_id,
        model:  model,
        cmd:    { name, value }
      })
    })
    const text = await res.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (err) {
        data = { message: text }
      }
    }
    if (!res.ok || data.code !== 200) throw new Error(`Govee Legacy control fel (status ${res.status}): ${JSON.stringify(data)}`)
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

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('⚠️ Govee getStates fel:', r.reason)
      }
    }

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
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.on_off', 'powerSwitch', changes.state === 'on' ? 1 : 0))
      }
      if (changes.brightness !== undefined) {
        const pct = Math.round((changes.brightness / 255) * 100)
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.range', 'brightness', pct))
      }
      if (changes.color_temp !== undefined) {
        const kelvin = Math.round(1_000_000 / changes.color_temp)
        cmds.push(this.#sendCommandOpenAPI(deviceConfig, 'devices.capabilities.color_setting', 'colorTemperatureK', kelvin))
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
