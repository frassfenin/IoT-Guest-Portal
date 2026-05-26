// ============================================================
//  Google Cast Bridge – TLS-socket utan externa beroenden
//  Fil: server/bridges/cast.js
//
//  Implementerar Google Cast-protokollets kärnfunktioner
//  (volym, play/pause) direkt via Node.js TLS-socket.
//  bridge_id i config.json = enhetens IP-adress.
//
//  Protokollet: Cast v2 över TLS (port 8009)
//  Meddelanden är Protocol Buffers, inbäddade i en
//  4-byte längd-prefix + protobuf payload.
// ============================================================

import tls      from 'tls'
import { once } from 'events'

// Cast Protocol Buffer – Vi behöver bara 3 fält:
//   1: namespace (string)   – t.ex. "urn:x-cast:com.google.cast.tp.connection"
//   2: source_id (string)   – avsändarens ID
//   3: destination_id (str) – mottagarens ID
//   5: payload_utf8 (string)– JSON-sträng
//
// Minimal protobuf-encoder (endast string-fält, wire type 2)
function encodeVarint(n) {
  const bytes = []
  while (n > 127) { bytes.push((n & 0x7f) | 0x80); n >>>= 7 }
  bytes.push(n)
  return Buffer.from(bytes)
}

function encodeString(fieldNumber, str) {
  const buf    = Buffer.from(str, 'utf8')
  const tag    = encodeVarint((fieldNumber << 3) | 2)
  const length = encodeVarint(buf.length)
  return Buffer.concat([tag, length, buf])
}

function buildCastMessage({ namespace, sourceId, destinationId, payload }) {
  const proto_ns     = encodeString(1, namespace)
  const proto_source = encodeString(2, sourceId)
  const proto_dest   = encodeString(3, destinationId)
  const proto_pl_tag = encodeVarint((5 << 3) | 2) // field 5, wire type 2
  const pl_buf       = Buffer.from(payload, 'utf8')
  const proto_pl_len = encodeVarint(pl_buf.length)
  const body         = Buffer.concat([proto_ns, proto_source, proto_dest, proto_pl_tag, proto_pl_len, pl_buf])
  const header       = Buffer.alloc(4)
  header.writeUInt32BE(body.length, 0)
  return Buffer.concat([header, body])
}

const NS_CONNECTION = 'urn:x-cast:com.google.cast.tp.connection'
const NS_RECEIVER   = 'urn:x-cast:com.google.cast.receiver'
const NS_MEDIA      = 'urn:x-cast:com.google.cast.media'
const SOURCE_ID     = 'sender-gastportal'
const CAST_PORT     = 8009

// ── Cast-anslutning (en per enhet) ───────────────────────────
class CastConnection {
  constructor(ip) {
    this.ip          = ip
    this.socket      = null
    this.reqId       = 1
    this.sessionId   = null
    this.mediaSession= null
    this.volume      = 0.5
    this.state       = 'idle'
  }

  async connect() {
    if (this.socket && !this.socket.destroyed) return

    this.socket = tls.connect({ host: this.ip, port: CAST_PORT, rejectUnauthorized: false })
    await once(this.socket, 'secureConnect')

    // Skicka CONNECT-meddelande
    this._send(NS_CONNECTION, 'receiver-0', JSON.stringify({ type: 'CONNECT' }))

    // Hämta initial status
    this._send(NS_RECEIVER, 'receiver-0', JSON.stringify({ type: 'GET_STATUS', requestId: this.reqId++ }))

    // Lyssna på inkommande meddelanden
    this.socket.on('data', (chunk) => this._onData(chunk))
    this.socket.on('error', () => { this.socket = null })
    this.socket.on('close', () => { this.socket = null })
  }

  _buf = Buffer.alloc(0)

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk])
    while (this._buf.length >= 4) {
      const len = this._buf.readUInt32BE(0)
      if (this._buf.length < 4 + len) break
      const msg = this._buf.slice(4, 4 + len)
      this._buf  = this._buf.slice(4 + len)
      this._onMessage(msg)
    }
  }

  _onMessage(msg) {
    // Extrahera payload (field 5) – enkel protobuf-läsning
    try {
      let offset = 0
      let payload = ''
      while (offset < msg.length) {
        const tagByte = msg[offset++]
        const field   = tagByte >> 3
        const wire    = tagByte & 0x07
        if (wire === 2) {
          let len = 0, shift = 0
          while (true) { const b = msg[offset++]; len |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7 }
          const value = msg.slice(offset, offset + len).toString('utf8')
          if (field === 5) payload = value
          offset += len
        } else { break } // Skip non-string fields for simplicity
      }
      if (!payload) return
      const data = JSON.parse(payload)
      if (data.type === 'RECEIVER_STATUS') {
        const vol = data.status?.volume
        if (vol) this.volume = vol.level ?? this.volume
        const apps = data.status?.applications
        this.sessionId = apps?.[0]?.sessionId ?? null
        this.state     = apps?.length ? 'playing' : 'idle'
      }
    } catch { /* Ignorera ogiltiga meddelanden */ }
  }

  _send(namespace, destinationId, payload) {
    if (!this.socket || this.socket.destroyed) return
    const msg = buildCastMessage({ namespace, sourceId: SOURCE_ID, destinationId, payload })
    this.socket.write(msg)
  }

  async setVolume(level) {
    await this.connect()
    const clipped = Math.min(1, Math.max(0, level))
    this._send(NS_RECEIVER, 'receiver-0',
      JSON.stringify({ type: 'SET_VOLUME', volume: { level: clipped }, requestId: this.reqId++ })
    )
    this.volume = clipped
  }

  async pause() {
    await this.connect()
    if (!this.sessionId) return
    this._send(NS_MEDIA, this.sessionId,
      JSON.stringify({ type: 'PAUSE', requestId: this.reqId++, mediaSessionId: this.mediaSession })
    )
  }

  async play() {
    await this.connect()
    if (!this.sessionId) return
    this._send(NS_MEDIA, this.sessionId,
      JSON.stringify({ type: 'PLAY', requestId: this.reqId++, mediaSessionId: this.mediaSession })
    )
  }

  close() {
    this.socket?.destroy()
    this.socket = null
  }
}

// ── Bridge-klass ──────────────────────────────────────────────
export class CastBridge {
  constructor() {
    this.connections = new Map() // entity_id → CastConnection
    console.log('📡 Google Cast Bridge initierad (inbyggd TLS-klient)')
  }

  #getOrCreate(device) {
    if (!this.connections.has(device.entity_id)) {
      this.connections.set(device.entity_id, new CastConnection(device.bridge_id))
    }
    return this.connections.get(device.entity_id)
  }

  async getStates(deviceConfigs) {
    return deviceConfigs.map((d) => {
      const conn = this.connections.get(d.entity_id)
      return {
        entity_id: d.entity_id,
        state: conn?.state ?? 'idle',
        attributes: {
          volume_level:  conn?.volume ?? 0.5,
          friendly_name: d.name,
        },
      }
    })
  }

  async setMedia(deviceConfig, changes) {
    const conn = this.#getOrCreate(deviceConfig)
    try {
      switch (changes.action) {
        case 'volume_set':  await conn.setVolume(changes.volume); break
        case 'media_pause': await conn.pause(); break
        case 'media_play':  await conn.play(); break
        case 'media_stop':  conn.close(); break
      }
    } catch (err) {
      console.error(`Cast ${deviceConfig.name}:`, err.message)
    }
  }

  startRealtime(io, deviceConfigs) {
    // Försök ansluta direkt
    deviceConfigs.forEach((d) => {
      const conn = this.#getOrCreate(d)
      conn.connect().catch(() => {})
    })

    this.pollTimer = setInterval(async () => {
      const states = await this.getStates(deviceConfigs)
      for (const s of states) io.emit('state_changed', { entity_id: s.entity_id, state: s })
    }, 15_000)

    console.log('🔄 Google Cast: Pollning var 15s')
  }

  destroy() {
    if (this.pollTimer) {
      console.log('🔌 Stänger Cast pollning-timer...')
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    // Stäng alla aktiva anslutningar
    for (const [id, conn] of this.connections.entries()) {
      console.log(`🔌 Stänger Cast-anslutning för ${id}...`)
      conn.close()
    }
    this.connections.clear()
  }
}
