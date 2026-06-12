// ============================================================
//  Philips Hue Bridge v2 – Lokal REST API + SSE realtid
//  Fil: server/bridges/hue.js
//
//  Hue Bridge använder ett självsignerat SSL-certifikat,
//  därför använder vi undici med rejectUnauthorized: false.
//
//  Autentisering: Tryck på knappen på Hue Bridge, kör sedan
//  npm run discover för att generera din API-nyckel.
// ============================================================

import { Agent, fetch } from 'undici'

// Hoppa över SSL-verifiering för Hue Bridges självskrivna cert
const agent = new Agent({ connect: { rejectUnauthorized: false } })

// Konvertera Hue-brightness (0-100 %) → HA-kompatibelt 0-255
const hueToStd = (b) => Math.round((b / 100) * 255)
const stdToHue = (b) => Math.round((b / 255) * 100)

// CIE 1931 xy color space conversion helper
function xyToHex(x, y) {
  const z = 1.0 - x - y
  const Y = 1.0
  const X = y > 0 ? (Y / y) * x : 0
  const Z = y > 0 ? (Y / y) * z : 0

  let r = X * 3.2406 - Y * 1.5372 - Z * 0.4986
  let g = -X * 0.9689 + Y * 1.8758 + Z * 0.0415
  let b = X * 0.0557 - Y * 0.2040 + Z * 1.0570

  const gamma = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  r = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)))
  g = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)))
  b = Math.max(0, Math.min(255, Math.round(gamma(b) * 255)))

  const toHex = (val) => val.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export class HueBridge {
  constructor({ ip, apiKey }) {
    if (!ip || !apiKey) {
      this.enabled = false
      console.warn('⚠️  Hue Bridge: HUE_BRIDGE_IP eller HUE_API_KEY saknas i .env')
      return
    }
    this.enabled = true
    this.ip      = ip
    this.apiKey  = apiKey
    this.baseUrl = `https://${ip}/clip/v2`
    this.headers = { 'hue-application-key': apiKey, 'Content-Type': 'application/json' }
    console.log(`💡 Hue Bridge initierad: ${ip}`)
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
    if (!res.ok) throw new Error(`Hue ${res.status}: ${text}`)
    return text ? JSON.parse(text) : null
  }

  // ── Hämta states för givna bridge_id:n ───────────────────
  async getStates(deviceConfigs) {
    if (!this.enabled) return []
    try {
      const { data } = await this.#req('GET', '/resource/light')
      const byId = new Map(data.map((l) => [l.id, l]))

      return deviceConfigs
        .filter((d) => byId.has(d.bridge_id))
        .map((d) => {
          const l = byId.get(d.bridge_id)
          return {
            entity_id: d.entity_id,
            state: l.on?.on ? 'on' : 'off',
            attributes: {
              brightness:  l.dimming         ? hueToStd(l.dimming.brightness) : 128,
              color_temp:  l.color_temperature?.mirek ?? 370,
              min_mireds:  153,
              max_mireds:  500,
              friendly_name: d.name,
              ...(l.color && { color: xyToHex(l.color.xy.x, l.color.xy.y) }),
            },
          }
        })
    } catch (err) {
      console.error('Hue getStates fel:', err.message)
      return []
    }
  }

  // ── Styr en lampa ─────────────────────────────────────────
  async setLight(deviceConfig, changes) {
    if (!this.enabled) return
    const body = {}

    if (changes.state === 'on')  body.on = { on: true }
    if (changes.state === 'off') body.on = { on: false }

    if (changes.brightness !== undefined) {
      body.on      = { on: true }
      body.dimming = { brightness: stdToHue(changes.brightness) }
    }
    if (changes.color_temp !== undefined) {
      body.color_temperature = { mirek: Math.round(changes.color_temp) }
    }
    if (changes.color !== undefined) {
      body.on = { on: true }
      const hex = changes.color.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16) / 255
      const g = parseInt(hex.substring(2, 4), 16) / 255
      const b = parseInt(hex.substring(4, 6), 16) / 255

      const rGamma = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
      const gGamma = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
      const bGamma = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

      const X = rGamma * 0.4124 + gGamma * 0.3576 + bGamma * 0.1805
      const Y = rGamma * 0.2126 + gGamma * 0.7152 + bGamma * 0.0722
      const Z = rGamma * 0.0193 + gGamma * 0.1192 + bGamma * 0.9505

      const sum = X + Y + Z
      if (sum > 0) {
        body.color = {
          xy: {
            x: X / sum,
            y: Y / sum
          }
        }
      }
    }

    await this.#req('PUT', `/resource/light/${deviceConfig.bridge_id}`, body)
  }

  // ── Realtidsuppdateringar via Server-Sent Events (SSE) ────
  // Hue Bridge v2 pushar alla state-ändringar via SSE.
  // Vi filtrerar och vidarebefordrar till Socket.io.
  startRealtime(io, deviceConfigs) {
    if (!this.enabled) return
    this.abortController = new AbortController()
    const idToEntity = new Map(deviceConfigs.map((d) => [d.bridge_id, d.entity_id]))

    const connect = async () => {
      try {
        console.log('🔗 Hue SSE: Ansluter...')
        const res = await fetch(`${this.baseUrl}/eventstream/clip/v2`, {
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
              const events = JSON.parse(line.slice(6))
              for (const event of events) {
                for (const item of event.data ?? []) {
                  if (item.type !== 'light') continue
                  const entity_id = idToEntity.get(item.id)
                  if (!entity_id) continue

                  io.emit('state_changed', {
                    entity_id,
                    state: {
                      state: item.on?.on ? 'on' : 'off',
                      attributes: {
                        ...(item.dimming && { brightness: hueToStd(item.dimming.brightness) }),
                        ...(item.color_temperature && { color_temp: item.color_temperature.mirek }),
                        ...(item.color && { color: xyToHex(item.color.xy.x, item.color.xy.y) }),
                      },
                    },
                  })
                }
              }
            } catch { /* Ignorera dåliga SSE-rader */ }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('🛑 Hue eventstream stängdes av abort controller.');
          return
        }
        console.error('Hue SSE-fel:', err.message, '– återansluter om 5s')
        setTimeout(connect, 5000)
      }
    }

    connect()
  }

  destroy() {
    if (this.abortController) {
      console.log('🔌 Stänger Hue eventstream...')
      this.abortController.abort()
      this.abortController = null
    }
  }
}
