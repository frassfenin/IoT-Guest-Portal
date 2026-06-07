import '@project-chip/matter-node.js'
import { NodeId } from '@project-chip/matter.js/datatype'

// Force Matter Node IDs to be within 32-bit range (1000 - 999999)
// to fix firmware bugs (e.g. Nanoleaf) where 64-bit Node IDs trigger "addNoc: 5" (InvalidNodeId)
NodeId.randomOperationalNodeId = () => {
  const min = 1000;
  const max = 999999;
  return NodeId(BigInt(Math.floor(Math.random() * (max - min + 1)) + min));
};

import express      from 'express'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import cors         from 'cors'
import dotenv       from 'dotenv'
import { readFileSync, rmSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { HueBridge   } from './bridges/hue.js'
import { IkeaBridge, IkeaTradfriGateway } from './bridges/ikea.js'
import { GoveeBridge } from './bridges/govee.js'
import { CastBridge  } from './bridges/cast.js'
import { MatterBridge } from './bridges/matter.js'
import { readRuntimeConfig, writeRuntimeConfig, DEFAULT_CONFIG } from './runtimeConfig.js'
import setupRouter   from './setup.js'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const PORT      = process.env.PORT || 3001

// ── Reset-kontroll på startup ────────────────────────────────
if (process.argv.includes('--reset') || process.env.RESET === 'true') {
  console.log('\n🧹 [RESET] Återställer gästportalen till 0 (rent bord)...')
  writeRuntimeConfig(DEFAULT_CONFIG)
  const matterStorePath = join(ROOT, 'server/data/matter-store')
  if (existsSync(matterStorePath)) {
    try {
      rmSync(matterStorePath, { recursive: true, force: true })
      console.log('🧹 [RESET] Tog bort matter-store (Matter Node-databasen).')
    } catch (err) {
      console.error('⚠️ [RESET] Kunde inte ta bort matter-store:', err.message)
    }
  }
  console.log('✨ [RESET] Gästportalen har återställts framgångsrikt!\n')
}

// ── Express + Socket.io ──────────────────────────────────────
const app        = express()
const httpServer = createServer(app)
const io         = new SocketIO(httpServer, { cors: { origin: '*' } })

app.use(cors())
app.use(express.json())

// ── Montera setup-router ─────────────────────────────────────
app.use('/api/setup', setupRouter)

// ────────────────────────────────────────────────────────────
//  Lazy bridge-initiering
//  Bridges laddas från runtimeConfig.json vid första anrop.
//  Om setup inte är klar returneras tomma bridges.
// ────────────────────────────────────────────────────────────
let _bridges  = null
let _rtConfig = null

function getBridges() {
  const rt = readRuntimeConfig()

  // Returnera cache om config inte förändrats
  if (_bridges && JSON.stringify(rt) === JSON.stringify(_rtConfig)) {
    return _bridges
  }

  // Om det finns inaktuella broar i cache, förstör dem först så att sockets och timers stängs ner!
  if (_bridges) {
    console.log('🧹 Stänger ner och rensar inaktuella bridges...')
    for (const bridge of Object.values(_bridges)) {
      try {
        bridge?.destroy?.()
      } catch (err) {
        console.error('Fel vid stängning av bridge:', err.message)
      }
    }
  }

  _rtConfig = rt

  if (!rt.setupComplete) {
    _bridges = { hue: null, ikea: null, govee: null, cast: null, matter: null }
    return _bridges
  }

  console.log('\n🔄 Laddar bridge-konfiguration från runtime-config.json')
  _bridges = {
    hue:       new HueBridge  ({ ip: rt.hue?.ip,    apiKey: rt.hue?.apiKey }),
    ikea:      rt.ikea?.bridge === 'ikea_tradfri'
      ? new IkeaTradfriGateway({ ip: rt.ikea?.ip, identity: rt.ikea?.identity, psk: rt.ikea?.psk })
      : new IkeaBridge        ({ ip: rt.ikea?.ip, token:  rt.ikea?.token  }),
    govee:     new GoveeBridge({ apiKey: rt.govee?.apiKey }),
    cast:      new CastBridge (),
    matter:    new MatterBridge(),
  }

  // Starta realtid för nya bridges
  startRealtime(_bridges, rt)

  return _bridges
}

// ── Hämta config: runtime-config prioriteras, config.json som fallback ──
function getConfig() {
  const rt = readRuntimeConfig()
  if (rt.setupComplete && rt.lights?.length > 0) return rt

  // Fallback till statisk config.json (för bakåtkompatibilitet)
  try {
    return JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'))
  } catch {
    return { scenes: [], lights: [], media_players: [], info: {} }
  }
}

// ── Hjälpfunktioner ──────────────────────────────────────────
function findLight(entity_id, config) {
  const light = config.lights.find((l) => l.entity_id === entity_id)
  if (!light) throw { status: 404, message: `Lampa ej hittad: ${entity_id}` }
  const bridge = getBridges()[light.bridge]
  if (!bridge) throw { status: 503, message: `Bridge '${light.bridge}' ej konfigurerad ännu` }
  return { light, bridge }
}

function findMedia(entity_id, config) {
  const player = (config.media_players ?? []).find((m) => m.entity_id === entity_id)
  if (!player) throw { status: 404, message: `Mediaspelare ej hittad: ${entity_id}` }

  const rt  = readRuntimeConfig()
  const castDevices = rt.cast ?? []
  // Cast-bridge om enheten är en Cast-enhet
  if (player.bridge === 'cast') {
    const bridge = getBridges().cast
    if (!bridge) throw { status: 503, message: 'Cast-bridge ej konfigurerad' }
    return { player, bridge }
  }
  throw { status: 400, message: `Okänd media-bridge: ${player.bridge}` }
}

// ──────────────────────────────────────────────────────────────
//  GET /api/config
// ──────────────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  const config = getConfig()
  // Lägg till Cast-enheter från runtimeConfig om setup är klar
  const rt = readRuntimeConfig()
  if (rt.setupComplete && rt.cast?.length > 0 && config.media_players?.length === 0) {
    config.media_players = rt.cast.map((c) => ({
      entity_id: `cast_${c.ip.replace(/\./g, '_')}`,
      bridge: 'cast',
      bridge_id: c.ip,
      name: c.name,
      icon: '📡',
    }))
  }
  res.json(config)
})

// ──────────────────────────────────────────────────────────────
//  GET /api/states
// ──────────────────────────────────────────────────────────────
app.get('/api/states', async (_req, res) => {
  const config  = getConfig()
  const bridges = getBridges()

  if (!readRuntimeConfig().setupComplete) {
    return res.json([])
  }

  try {
    const lightsByBridge = {}
    for (const l of (config.lights ?? [])) {
      if (!lightsByBridge[l.bridge]) lightsByBridge[l.bridge] = []
      lightsByBridge[l.bridge].push(l)
    }

    const [lightStates, castStates] = await Promise.all([
      Promise.all(
        Object.entries(lightsByBridge).map(([name, devices]) =>
          bridges[name]?.getStates(devices) ?? []
        )
      ).then((a) => a.flat()),

      (() => {
        const rt = readRuntimeConfig()
        const castDevices = (rt.cast ?? []).map((c) => ({
          entity_id: `cast_${c.ip.replace(/\./g, '_')}`,
          bridge: 'cast', bridge_id: c.ip, name: c.name,
        }))
        return bridges.cast?.getStates(castDevices) ?? []
      })(),
    ])

    res.json([...lightStates, ...castStates])
  } catch (err) {
    console.error('GET /api/states:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/scene/:scene_id
// ──────────────────────────────────────────────────────────────
app.post('/api/scene/:scene_id', async (req, res) => {
  const { scene_id } = req.params
  const config = getConfig()
  const scene  = (config.scenes ?? []).find((s) => s.id === scene_id)
  if (!scene) return res.status(404).json({ error: `Scen ej hittad: ${scene_id}` })

  try {
    await Promise.allSettled(
      (scene.actions ?? []).map(async (action) => {
        const lightConfig = (config.lights ?? []).find((l) => l.entity_id === action.entity_id)
        if (!lightConfig) return
        const bridge = getBridges()[lightConfig.bridge]
        if (!bridge) return
        await bridge.setLight(lightConfig, action)
      })
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/light/:entity_id
// ──────────────────────────────────────────────────────────────
app.post('/api/light/:entity_id', async (req, res) => {
  try {
    const { light, bridge } = findLight(req.params.entity_id, getConfig())
    await bridge.setLight(light, req.body)
    res.json({ ok: true })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    res.status(500).json({ error: String(err) })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/media/:entity_id
// ──────────────────────────────────────────────────────────────
app.post('/api/media/:entity_id', async (req, res) => {
  const ALLOWED = ['media_play', 'media_pause', 'media_stop', 'volume_set']
  if (!ALLOWED.includes(req.body.action)) {
    return res.status(400).json({ error: `Otillåten action: ${req.body.action}` })
  }
  try {
    const config = getConfig()
    const rt     = readRuntimeConfig()
    const entity_id = req.params.entity_id

    // Slå upp Cast-enhet från runtimeConfig
    const castDevice = (rt.cast ?? []).find(
      (c) => `cast_${c.ip.replace(/\./g, '_')}` === entity_id
    )
    if (castDevice) {
      const bridge = getBridges().cast
      await bridge?.setMedia({ ...castDevice, entity_id, bridge: 'cast', bridge_id: castDevice.ip }, req.body)
      return res.json({ ok: true })
    }

    const { player, bridge } = findMedia(entity_id, config)
    await bridge.setMedia(player, req.body)
    res.json({ ok: true })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    res.status(500).json({ error: String(err) })
  }
})

// ── Serve static files from client/dist in production ────────
const clientDistPath = join(ROOT, 'client/dist')
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  app.get('*', (req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'))
  })
}

// ──────────────────────────────────────────────────────────────
//  Socket.io: Lyssna på setup_complete för att ladda om bridges
// ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('setup_complete', () => {
    console.log('⚙️  Setup klar – laddar om bridges...')
    _bridges  = null   // Rensa cache
    _rtConfig = null
    getBridges()       // Ladda direkt
    io.emit('reload')  // Be alla klienter att ladda om
  })
})

// ──────────────────────────────────────────────────────────────
//  Starta realtid för bridges
// ──────────────────────────────────────────────────────────────
function startRealtime(bridges, config) {
  const lightsByBridge = {}
  for (const l of (config.lights ?? [])) {
    if (!lightsByBridge[l.bridge]) lightsByBridge[l.bridge] = []
    lightsByBridge[l.bridge].push(l)
  }

  // SSE-bridges (Hue + IKEA)
  for (const [name, devices] of Object.entries(lightsByBridge)) {
    bridges[name]?.startRealtime?.(io, devices)
  }

  // Cast-polling
  const castDevices = (config.cast ?? []).map((c) => ({
    entity_id: `cast_${c.ip.replace(/\./g, '_')}`,
    bridge: 'cast', bridge_id: c.ip, name: c.name,
  }))
  if (castDevices.length > 0) bridges.cast?.startRealtime?.(io, castDevices)

  // Govee-polling
  if (lightsByBridge.govee) bridges.govee?.startRealtime?.(io, lightsByBridge.govee)
}

// ──────────────────────────────────────────────────────────────
//  Starta servern
// ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  const rt = readRuntimeConfig()
  if (rt.setupComplete) {
    getBridges()  // Initiera bridges direkt vid start
    console.log(`\n🏠 Gästportal körs på http://localhost:${PORT} (setup klar)`)
  } else {
    console.log(`\n⚙️  Gästportal körs på http://localhost:${PORT}`)
    console.log(`   Setup krävs – öppna http://localhost:5173 för att konfigurera\n`)
  }
})
