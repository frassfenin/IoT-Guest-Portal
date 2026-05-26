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
