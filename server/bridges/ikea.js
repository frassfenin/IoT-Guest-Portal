// ============================================================
//  IKEA Dirigera Hub – Lokal REST API + SSE realtid
//  Fil: server/bridges/ikea.js
//
//  Dirigera-hubben kör HTTPS på port 8443 med ett
//  självskrivet certifikat (som Hue). Auth via Bearer-token
//  som genereras med: npm run discover
// ============================================================

import { Agent, fetch } from 'undici'
import tradfriPkg from 'node-tradfri-client'

const { TradfriClient, AccessoryTypes } = tradfriPkg ?? {}
const agent = new Agent({ connect: { rejectUnauthorized: false } })

// IKEA använder Kelvin, vi använder Mireds internt
const kelvinToMireds = (k) => Math.round(1_000_000 / k)
const miredsToKelvin = (m) => Math.round(1_000_000 / m)

// IKEA lightLevel är 1-100 (procent), vi använder 0-255
const ikeaToStd = (l) => Math.round((l / 100) * 255)
const stdToIkea = (b) => Math.round((b / 255) * 100)

export class IkeaBridge {
  constructor({ ip, token }) {
    if (!ip || !token) {
      this.enabled = false
      console.warn('⚠️  IKEA Dirigera: IKEA_HUB_IP eller IKEA_TOKEN saknas i .env')
      return
    }
    this.enabled = true
    this.ip      = ip
    this.token   = token
    this.baseUrl = `https://${ip}:8443/v1`
    this.headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    console.log(`🏮 IKEA Dirigera initierad: ${ip}`)
  }

  // ── Intern helper ─────────────────────────────────────────
  async #req(method, path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
      dispatcher: agent,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`IKEA ${res.status}: ${text}`)
    return text ? JSON.parse(text) : null
  }

  // ── Hämta states ─────────────────────────────────────────
  async getStates(deviceConfigs) {
    if (!this.enabled) return []
    try {
      const [lights, outlets] = await Promise.all([
        this.#req('GET', '/lights').catch(() => []),
        this.#req('GET', '/outlets').catch(() => [])
      ])
      
      const byId = new Map([
        ...lights.map((l) => [l.id, { ...l, isOutlet: false }]),
        ...outlets.map((o) => [o.id, { ...o, isOutlet: true }])
      ])

      return deviceConfigs
        .filter((d) => byId.has(d.bridge_id))
        .map((d) => {
          const l    = byId.get(d.bridge_id)
          const attr = l.attributes ?? {}
          return {
            entity_id: d.entity_id,
            state: attr.isOn ? 'on' : 'off',
            attributes: {
              ...(l.isOutlet ? {} : {
                brightness:    attr.lightLevel       ? ikeaToStd(attr.lightLevel) : 128,
                color_temp:    attr.colorTemperature ? kelvinToMireds(attr.colorTemperature) : 370,
                min_mireds:    153,
                max_mireds:    500,
              }),
              friendly_name: attr.customName ?? d.name,
            },
          }
        })
    } catch (err) {
      console.error('IKEA getStates fel:', err.message)
      return []
    }
  }

  // ── Styr en lampa ─────────────────────────────────────────
  async setLight(deviceConfig, changes) {
    if (!this.enabled) return
    const attributes = {}

    if (changes.state === 'on')  attributes.isOn = true
    if (changes.state === 'off') attributes.isOn = false

    const isOutlet = deviceConfig.isOutlet

    if (changes.brightness !== undefined && !isOutlet) {
      attributes.isOn       = true
      attributes.lightLevel = stdToIkea(changes.brightness)
    }
    if (changes.color_temp !== undefined && !isOutlet) {
      attributes.colorTemperature = miredsToKelvin(changes.color_temp)
    }

    const endpoint = isOutlet ? 'outlets' : 'lights'
    await this.#req('PATCH', `/${endpoint}/${deviceConfig.bridge_id}`, [{ attributes }])
  }

  // ── Realtid via SSE ───────────────────────────────────────
  startRealtime(io, deviceConfigs) {
    if (!this.enabled) return
    this.abortController = new AbortController()
    const idToDevice = new Map(deviceConfigs.map((d) => [d.bridge_id, d]))

    const connect = async () => {
      try {
        console.log('🔗 IKEA SSE: Ansluter...')
        const res = await fetch(`${this.baseUrl}/sse`, {
          headers: { ...this.headers, Accept: 'text/event-stream' },
          dispatcher: agent,
          signal: this.abortController.signal
        })

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })

          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type !== 'deviceStateChanged') continue

              const devConfig = idToDevice.get(event.id)
              if (!devConfig) continue

              const attr = event.attributes ?? {}
              io.emit('state_changed', {
                entity_id: devConfig.entity_id,
                state: {
                  state: attr.isOn ? 'on' : 'off',
                  attributes: {
                    ...(!devConfig.isOutlet && attr.lightLevel       !== undefined && { brightness: ikeaToStd(attr.lightLevel) }),
                    ...(!devConfig.isOutlet && attr.colorTemperature !== undefined && { color_temp: kelvinToMireds(attr.colorTemperature) }),
                  },
                },
              })
            } catch { /* Ignorera */ }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('🛑 IKEA Dirigera eventstream stängdes av abort controller.')
          return
        }
        console.error('IKEA SSE-fel:', err.message, '– återansluter om 5s')
        setTimeout(connect, 5000)
      }
    }

    connect()
  }

  destroy() {
    if (this.abortController) {
      console.log('🔌 Stänger IKEA Dirigera eventstream...')
      this.abortController.abort()
      this.abortController = null
    }
  }
}

// ============================================================
//  IKEA Trådfri Gateway – Äldre CoAP/DTLS-baserat API
//  Fil: server/bridges/ikea.js
// ============================================================
export class IkeaTradfriGateway {
  constructor({ ip, identity, psk }) {
    if (!ip || !identity || !psk) {
      this.enabled = false
      console.warn('⚠️  IKEA Trådfri Gateway: IP, identity eller psk saknas i runtimeConfig')
      return
    }
    this.enabled = true
    this.ip      = ip
    this.identity = identity
    this.psk     = psk
    this.client  = null
    this.devices = {}
    console.log(`🏮 IKEA Trådfri Gateway initierad: ${ip}`)
  }

  async connect() {
    if (this.client) return
    try {
      this.client = new TradfriClient(this.ip, { watchConnection: true })
      await this.client.connect(this.identity, this.psk)
      
      // Lyssna på enhetsuppdateringar och cacha dem
      this.client.on('device updated', (device) => {
        this.devices[String(device.instanceId)] = device
        
        // Skicka realtid via socket.io om ansluten
        if (this.io && this.idToEntity && (device.type === AccessoryTypes.lightbulb || device.type === AccessoryTypes.plug)) {
          const entity_id = this.idToEntity.get(String(device.instanceId))
          if (entity_id) {
            const light = device.lightList?.[0]
            const plug = device.plugList?.[0]
            this.io.emit('state_changed', {
              entity_id,
              state: {
                state: (light ? light.onOff : plug?.onOff) ? 'on' : 'off',
                attributes: {
                  ...(light && { brightness: Math.round((light.dimmer / 100) * 255) }),
                },
              },
            })
          }
        }
      })

      await this.client.observeDevices()
      console.log('✅ IKEA Trådfri Gateway: Ansluten och observerar enheter!')
    } catch (err) {
      console.error('❌ IKEA Trådfri Gateway: Anslutningsfel:', err.message)
      this.client = null
    }
  }

  async getStates(deviceConfigs) {
    if (!this.enabled) return []
    if (!this.client) {
      await this.connect()
    }

    return deviceConfigs
      .map((d) => {
        const dev = this.devices[String(d.bridge_id)]
        if (!dev) return null
        const light = dev.lightList?.[0]
        const plug = dev.plugList?.[0]
        if (!light && !plug) return null
        return {
          entity_id: d.entity_id,
          state: (light ? light.onOff : plug?.onOff) ? 'on' : 'off',
          attributes: {
            brightness:    light?.dimmer ? Math.round((light.dimmer / 100) * 255) : 128,
            color_temp:    light?.colorTemperature ? Math.round(light.colorTemperature) : 370,
            min_mireds:    153,
            max_mireds:    500,
            friendly_name: dev.name ?? d.name,
          },
        }
      })
      .filter(Boolean)
  }

  async setLight(deviceConfig, changes) {
    if (!this.enabled) return
    if (!this.client) {
      await this.connect()
    }

    const dev = this.devices[String(deviceConfig.bridge_id)]
    if (!dev) {
      console.warn(`⚠️ IKEA Trådfri: Enhet ${deviceConfig.bridge_id} hittades inte i cache`)
      return
    }

    const operation = {}
    if (changes.state === 'on') operation.onOff = true
    if (changes.state === 'off') operation.onOff = false

    if (changes.brightness !== undefined && dev.type === AccessoryTypes.lightbulb) {
      operation.onOff = true
      operation.dimmer = Math.max(0, Math.min(100, Math.round((changes.brightness / 255) * 100)))
    }

    if (changes.color_temp !== undefined && dev.type === AccessoryTypes.lightbulb) {
      // Mappa mireds (153-500) till procent (0-100) för färgtemperatur
      const pct = Math.round(((changes.color_temp - 153) / (500 - 153)) * 100)
      operation.colorTemperature = Math.max(0, Math.min(100, pct))
    }

    try {
      if (dev.type === AccessoryTypes.lightbulb) {
        await this.client.operateLight(dev, operation)
      } else if (dev.type === AccessoryTypes.plug) {
        await this.client.operatePlug(dev, operation)
      }
    } catch (err) {
      console.error(`Fel vid styrning av IKEA Trådfri-enhet ${deviceConfig.bridge_id}:`, err.message)
    }
  }

  startRealtime(io, deviceConfigs) {
    if (!this.enabled) return
    this.io = io
    this.idToEntity = new Map(deviceConfigs.map((d) => [String(d.bridge_id), d.entity_id]))
    this.connect()
  }

  destroy() {
    if (this.client) {
      console.log('🔌 Stänger IKEA Trådfri Gateway CoAP anslutning...')
      try {
        this.client.destroy()
      } catch (e) {
        console.error('Fel vid stängning av Trådfri Gateway:', e.message)
      }
      this.client = null
    }
  }
}

