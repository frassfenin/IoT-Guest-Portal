// ============================================================
//  Setup Router – API-endpoints för first-run konfiguration
//  Fil: server/setup.js
//
//  Exponerar endpoints som setup-wizarden i frontend anropar
//  för att para ihop och testa varje bridge, samt spara
//  den färdiga konfigurationen.
// ============================================================

import { Router } from 'express'
import { Agent, fetch as undiciF } from 'undici'
import { createHash, randomBytes } from 'crypto'
import { readRuntimeConfig, writeRuntimeConfig, updateRuntimeConfig, DEFAULT_CONFIG } from './runtimeConfig.js'
import tradfriPkg from 'node-tradfri-client'
import dgram from 'dgram'
import { existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const { TradfriClient } = tradfriPkg ?? {}

const router = Router()
const agent  = new Agent({ connect: { rejectUnauthorized: false } })

// ──────────────────────────────────────────────────────────────
//  GET /api/setup/status
//  Berättar om appen behöver konfigureras eller redan är klar.
// ──────────────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  const cfg = readRuntimeConfig()
  res.json({ setupNeeded: !cfg.setupComplete })
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/hue/discover
//  Försöker hitta Hue Bridge automatiskt via Hues discovery API.
//  Returnerar IP-adressen om den hittas.
// ──────────────────────────────────────────────────────────────
router.post('/hue/discover', async (_req, res) => {
  try {
    const r = await undiciF('https://discovery.meethue.com/', { signal: AbortSignal.timeout(5000) })
    if (!r.ok) {
      console.warn(`⚠️ Hue Discovery server svarade med status: ${r.status}`)
      return res.json({ found: false })
    }
    const text = await r.text()
    if (!text || text.trim() === '') {
      console.warn('⚠️ Hue Discovery server svarade med tomt innehåll')
      return res.json({ found: false })
    }

    let data
    try {
      data = JSON.parse(text)
    } catch (parseErr) {
      console.error('⚠️ Hue Discovery svarade med ogiltig JSON:', text.slice(0, 150))
      return res.json({ found: false })
    }

    if (Array.isArray(data) && data.length > 0) {
      return res.json({ found: true, ip: data[0].internalipaddress })
    }
    res.json({ found: false })
  } catch (err) {
    console.error('⚠️ Hue Discovery misslyckades:', err.message)
    res.json({ found: false })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/hue/pair
//  Body: { ip }
//  Skapar ett Hue-applikationskonto (användaren måste ha
//  tryckt på Bridge-knappen precis innan).
// ──────────────────────────────────────────────────────────────
router.post('/hue/pair', async (req, res) => {
  const { ip } = req.body
  if (!ip) return res.status(400).json({ error: 'ip krävs' })

  try {
    const r    = await undiciF(`https://${ip}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devicetype: 'gastportal#server', generateclientkey: true }),
      dispatcher: agent,
      signal: AbortSignal.timeout(5000),
    })
    const data = await r.json()

    if (data[0]?.error) {
      const { description } = data[0].error
      return res.status(400).json({ error: description })
    }

    const apiKey = data[0]?.success?.username
    if (!apiKey) return res.status(400).json({ error: 'Inget svar från Bridge' })

    // Hämta antal lampor som bevis på lyckad koppling
    const lightsRes  = await undiciF(`https://${ip}/clip/v2/resource/light`, {
      headers: { 'hue-application-key': apiKey },
      dispatcher: agent,
    })
    const { data: lights } = await lightsRes.json()

    // Spara i runtimeConfig
    updateRuntimeConfig({ hue: { ip, apiKey } })

    res.json({ ok: true, ip, apiKey, lightCount: lights?.length ?? 0 })
  } catch (err) {
    res.status(500).json({ error: `Anslutningsfel: ${err.message}` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/hue/lights
//  Listar alla lampor på den pparade Hue Bridge.
// ──────────────────────────────────────────────────────────────
router.post('/hue/lights', async (req, res) => {
  const cfg = readRuntimeConfig()
  const ip  = req.body.ip  || cfg.hue?.ip
  const key = req.body.apiKey || cfg.hue?.apiKey
  if (!ip || !key) return res.status(400).json({ error: 'Hue ej konfigurerad' })

  try {
    const r    = await undiciF(`https://${ip}/clip/v2/resource/light`, {
      headers: { 'hue-application-key': key },
      dispatcher: agent,
    })
    const { data } = await r.json()
    res.json({
      lights: data.map((l) => ({
        id: l.id,
        name: l.metadata?.name ?? l.id,
        supports_brightness: !!l.dimming,
        supports_color_temp: !!l.color_temperature
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/ikea/lights
//  Listar alla lampor från IKEA Dirigera eller Trådfri Gateway.
// ──────────────────────────────────────────────────────────────
router.post('/ikea/lights', async (req, res) => {
  const cfg = readRuntimeConfig()
  const ip = req.body.ip || cfg.ikea?.ip
  const token = req.body.token || cfg.ikea?.token
  const bridge = req.body.bridge || cfg.ikea?.bridge

  if (!ip) return res.status(400).json({ error: 'IKEA ej konfigurerad' })

  try {
    if (bridge === 'ikea_tradfri') {
      const psk = req.body.psk || cfg.ikea?.psk
      const identity = req.body.identity || cfg.ikea?.identity
      if (!psk || !identity) return res.status(400).json({ error: 'Trådfri credentials saknas' })

      const client = new TradfriClient(ip)
      await client.connect(identity, psk)
      await client.observeDevices()
      
      // Vänta tills enhetslistan har stabiliserats (CoAP är asynkront)
      let prevCount = 0
      let stableCount = 0
      for (let i = 0; i < 20; i++) { // Max 4 sekunder
        await new Promise((resolve) => setTimeout(resolve, 200))
        const currentCount = Object.keys(client.devices).length
        if (currentCount > 0 && currentCount === prevCount) {
          stableCount++
          if (stableCount >= 3) break // Stabil i 600ms
        } else {
          stableCount = 0
        }
        prevCount = currentCount
      }
      
      const lights = []
      for (const id in client.devices) {
        const d = client.devices[id]
        if (d.type === 2 || d.type === 3) { // 2 = lightbulb, 3 = plug
          const light = d.lightList?.[0]
          const plug = d.plugList?.[0]
          lights.push({
            id: String(d.instanceId),
            name: d.name ?? `Trådfri ${d.type === 3 ? 'Uttag' : 'Lampa'} ${d.instanceId}`,
            supports_brightness: d.type === 2 && light?.dimmer !== undefined,
            supports_color_temp: d.type === 2 && light?.colorTemperature !== undefined,
            isOutlet: d.type === 3
          })
        }
      }
      client.destroy()
      res.json({ lights })
    } else {
      if (!token) return res.status(400).json({ error: 'Dirigera token saknas' })
      
      let rawLights = []
      let rawOutlets = []
      
      try {
        const lightsRes = await undiciF(`https://${ip}:8443/v1/lights`, {
          headers: { Authorization: `Bearer ${token}` },
          dispatcher: agent,
        })
        if (lightsRes.ok) rawLights = await lightsRes.json()
      } catch (e) {
        console.error('Dirigera lights query failed:', e.message)
      }

      try {
        const outletsRes = await undiciF(`https://${ip}:8443/v1/outlets`, {
          headers: { Authorization: `Bearer ${token}` },
          dispatcher: agent,
        })
        if (outletsRes.ok) rawOutlets = await outletsRes.json()
      } catch (e) {
        console.error('Dirigera outlets query failed:', e.message)
      }

      const combined = [
        ...rawLights.map((l) => ({
          id: l.id,
          name: l.attributes?.customName ?? l.id,
          supports_brightness: l.attributes?.lightLevel !== undefined,
          supports_color_temp: l.attributes?.colorTemperature !== undefined,
          isOutlet: false
        })),
        ...rawOutlets.map((o) => ({
          id: o.id,
          name: o.attributes?.customName ?? `Uttag ${o.id.slice(0, 4)}`,
          supports_brightness: false,
          supports_color_temp: false,
          isOutlet: true
        }))
      ]

      res.json({ lights: combined })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/govee/lights
//  Listar alla enheter från Govee Cloud API.
// ──────────────────────────────────────────────────────────────
router.post('/govee/lights', async (req, res) => {
  const cfg = readRuntimeConfig()
  const key = req.body.apiKey || cfg.govee?.apiKey
  if (!key) return res.status(400).json({ error: 'Govee API-nyckel saknas' })

  try {
    // 1. Testa nya Govee OpenAPI först
    let r = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
      headers: { 'Govee-API-Key': key },
    })
    
    if (r.ok) {
      const body = await r.json()
      // Nya OpenAPI returnerar enheter direkt i body.data som en array, eller som body.data.devices
      const devices = Array.isArray(body.data) ? body.data : (body.data?.devices ?? [])
      if (devices.length > 0) {
        return res.json({
          lights: devices.map((d) => ({
            id: d.device,
            name: d.deviceName ?? d.device,
            model: d.sku || d.model,
            supports_brightness: true,
            supports_color_temp: true,
            apiVersion: 'openapi'
          }))
        })
      }
    }

    // 2. Fallback till gamla Govee API v1
    let rLegacy = await fetch('https://developer-api.govee.com/v1/devices', {
      headers: { 'Govee-API-Key': key },
    })
    let bodyLegacy = {}
    const contentType = rLegacy.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      bodyLegacy = await rLegacy.json()
    } else {
      const text = await rLegacy.text()
      bodyLegacy = { message: text }
    }
    if (!rLegacy.ok) {
      throw new Error(bodyLegacy.message || `Govee API-fel (OpenAPI status: ${r.status}, Legacy status: ${rLegacy.status})`)
    }

    const devicesLegacy = bodyLegacy.data?.devices ?? []
    res.json({
      lights: devicesLegacy.map((d) => ({
        id: d.device,
        name: d.deviceName ?? d.device,
        model: d.model,
        supports_brightness: true,
        supports_color_temp: true,
        apiVersion: 'legacy'
      }))
    })
  } catch (err) {
    res.status(500).json({ error: `Govee-anslutning misslyckades: ${err.message}` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/ikea/pair
//  Body: { ip, code }  (code = 9-siffrig kod på undersidan av hubben)
//  Utför PKCE OAuth-flödet mot Dirigera.
// ──────────────────────────────────────────────────────────────
router.post('/ikea/pair', async (req, res) => {
  const { ip, code } = req.body
  if (!ip || !code) return res.status(400).json({ error: 'ip och code krävs' })

  try {
    // PKCE: code verifier + challenge
    const verifier  = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')

    // Steg 1: Hämta auth-kod med pairing-koden
    const authRes = await undiciF(
      `https://${ip}:8443/v1/oauth/authorize?` +
      `audience=homesmart.local&response_type=code` +
      `&code_challenge=${challenge}&code_challenge_method=S256`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${code.replace(/\s/g, '')}`).toString('base64')}`,
        },
        dispatcher: agent,
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!authRes.ok) {
      const text = await authRes.text()
      return res.status(400).json({ error: `Felaktig kod (${authRes.status}): ${text}` })
    }
    const { code: authCode } = await authRes.json()

    // Steg 2: Byt auth-kod mot access token
    const tokenRes = await undiciF(`https://${ip}:8443/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        code_verifier: verifier,
      }).toString(),
      dispatcher: agent,
    })
    const { access_token } = await tokenRes.json()
    if (!access_token) return res.status(400).json({ error: 'Kunde inte hämta token' })

    // Hämta antal lampor som bevis
    const lightsRes = await undiciF(`https://${ip}:8443/v1/lights`, {
      headers: { Authorization: `Bearer ${access_token}` },
      dispatcher: agent,
    })
    const lights = await lightsRes.json()

    updateRuntimeConfig({ ikea: { bridge: 'ikea', ip, token: access_token } })

    res.json({ ok: true, ip, token: access_token, lightCount: Array.isArray(lights) ? lights.length : 0 })
  } catch (err) {
    res.status(500).json({ error: `Anslutningsfel: ${err.message}` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/ikea_tradfri/pair
//  Body: { ip, securityCode }
//  Parar och genererar identity/psk för äldre IKEA Trådfri Gateway.
// ──────────────────────────────────────────────────────────────
router.post('/ikea_tradfri/pair', async (req, res) => {
  const { ip, securityCode } = req.body
  if (!ip || !securityCode) return res.status(400).json({ error: 'ip och securityCode krävs' })

  try {
    const client = new TradfriClient(ip)
    const { identity, psk } = await client.authenticate(securityCode)

    // Spara i runtimeConfig med bridge: 'ikea_tradfri'
    updateRuntimeConfig({
      ikea: {
        bridge: 'ikea_tradfri',
        ip,
        identity,
        psk,
      },
    })

    // Anslut tillfälligt för att verifiera och räkna lampor
    await client.connect(identity, psk)
    await client.observeDevices()

    // Låt enheterna laddas in kort
    await new Promise((resolve) => setTimeout(resolve, 1500))

    let lightCount = 0
    for (const id in client.devices) {
      if (client.devices[id].type === 2) { // 2 = AccessoryTypes.lightbulb
        lightCount++
      }
    }

    client.destroy()

    res.json({ ok: true, ip, identity, psk, lightCount })
  } catch (err) {
    res.status(500).json({ error: `Anslutningsfel till Trådfri: ${err.message}` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/govee/test
//  Body: { apiKey }
//  Testar Govee-nyckeln och listar enheter.
// ──────────────────────────────────────────────────────────────
router.post('/govee/test', async (req, res) => {
  const { apiKey } = req.body
  if (!apiKey) return res.status(400).json({ error: 'apiKey krävs' })

  try {
    // 1. Testa OpenAPI först
    let r = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
      headers: { 'Govee-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    
    if (r.ok) {
      const body = await r.json()
      const devices = Array.isArray(body.data) ? body.data : (body.data?.devices ?? [])
      updateRuntimeConfig({ govee: { apiKey } })
      return res.json({ ok: true, deviceCount: devices.length })
    }

    // 2. Fallback till Legacy API
    const rLegacy = await fetch('https://developer-api.govee.com/v1/devices', {
      headers: { 'Govee-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    
    if (rLegacy.ok) {
      const bodyLegacy = await rLegacy.json()
      const devicesLegacy = bodyLegacy.data?.devices ?? []
      updateRuntimeConfig({ govee: { apiKey } })
      return res.json({ ok: true, deviceCount: devicesLegacy.length })
    }

    if (r.status === 401 || rLegacy.status === 401) {
      return res.status(401).json({ error: 'Ogiltig API-nyckel' })
    }

    throw new Error(`Govee API-fel (OpenAPI status: ${r.status}, Legacy status: ${rLegacy.status})`)
  } catch (err) {
    res.status(500).json({ error: `Anslutningsfel: ${err.message}` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/cast/test
//  Body: { ip, name }
//  Testar TLS-anslutning till en Cast-enhet.
// ──────────────────────────────────────────────────────────────
router.post('/cast/test', async (req, res) => {
  const { ip, name = 'Google Streamer' } = req.body
  if (!ip) return res.status(400).json({ error: 'ip krävs' })

  const tls  = await import('tls')
  const { once } = await import('events')

  try {
    const socket = tls.connect({ host: ip, port: 8009, rejectUnauthorized: false })
    await Promise.race([
      once(socket, 'secureConnect'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ])
    socket.destroy()
    res.json({ ok: true })
  } catch {
    res.status(400).json({ error: `Kunde inte ansluta till ${ip}:8009 – Är IP-adressen korrekt?` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/matter/discover
//  Söker efter oparade Matter-enheter på nätverket via mDNS.
// ──────────────────────────────────────────────────────────────
router.post('/matter/discover', async (_req, res) => {
  try {
    const { MatterBridge } = await import('./bridges/matter.js')
    
    let tempServer = null
    let controller = null

    // Om det finns en aktiv permanent MatterBridge, använd dess controller direkt!
    if (MatterBridge.activeInstance && MatterBridge.activeInstance.controller) {
      console.log('🧱 Matter Scan: Använder aktiv permanent MatterBridge controller för skanning.')
      controller = MatterBridge.activeInstance.controller
    } else {
      console.log('🧱 Matter Scan: Skapar temporär server för skanning...')
      const { StorageBackendMemory } = await import('@project-chip/matter.js/storage')
      const { StorageManager } = await import('@project-chip/matter.js/storage')
      const { MatterServer, CommissioningController } = await import('@project-chip/matter.js')

      const tempStorage = new StorageBackendMemory()
      const tempManager = new StorageManager(tempStorage)
      await tempManager.initialize()

      tempServer = new MatterServer(tempManager)
      controller = new CommissioningController({
        autoConnect: false,
        adminFabricLabel: "ScanController"
      })
      tempServer.addCommissioningController(controller)
      await tempServer.start()
    }

    // Skanna efter oparade enheter i 4 sekunder
    const devices = await controller.discoverCommissionableDevices({}, undefined, undefined, 4)

    const list = devices.map((d, i) => ({
      id: `${d.V ?? ''}_${d.P ?? ''}_${d.D ?? ''}_${i}`,
      name: `Matter Enhet (Vendor: ${d.V ?? 'Okänd'}, Product: ${d.P ?? 'Okänd'})`,
      vendorId: d.V,
      productId: d.P,
      discriminator: d.D,
      instanceName: d.instanceId,
    }))

    res.json({ found: list })
    
    if (tempServer) {
      try { await tempServer.close() } catch {}
    }
  } catch (err) {
    console.error('Matter discovery error:', err.message)
    res.status(500).json({ error: `Kunde inte skanna Matter-enheter: ${err.message}` })
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/matter/pair
//  Body: { code, discriminator, instanceName }
//  Parar och driftsätter en Matter-enhet med en 11- eller 21-siffrig PIN-kod.
// ──────────────────────────────────────────────────────────────
router.post('/matter/pair', async (req, res) => {
  const { code, discriminator, instanceName } = req.body
  if (!code) return res.status(400).json({ error: 'code krävs' })

  const { ManualPairingCodeCodec } = await import('@matter/types')
  const { OnOffCluster, LevelControlCluster } = await import('@project-chip/matter.js/cluster')
  const { MatterBridge } = await import('./bridges/matter.js')

  let server = null
  let controller = null

  try {
    // Avkoda manuell setupkod för att få discriminator och passcode
    let pairingCodeCodec
    try {
      pairingCodeCodec = ManualPairingCodeCodec.decode(code)
    } catch (parseErr) {
      return res.status(400).json({ error: `Ogiltig parningskod: ${parseErr.message}` })
    }

    if (MatterBridge.activeInstance && MatterBridge.activeInstance.controller) {
      console.log('🧱 Matter Pairing: Använder aktiv permanent MatterBridge för driftsättning.')
      controller = MatterBridge.activeInstance.controller
    } else {
      console.log('🧱 Matter Pairing: Startar lokal temporär server för driftsättning...')
      const { StorageBackendDisk } = await import('@project-chip/matter-node.js/storage')
      const { StorageManager } = await import('@project-chip/matter.js/storage')
      const { MatterServer, CommissioningController } = await import('@project-chip/matter.js')

      const storageBackend = new StorageBackendDisk('server/data/matter-store')
      const storageManager = new StorageManager(storageBackend)
      await storageManager.initialize()

      server = new MatterServer(storageManager)
      controller = new CommissioningController({
        autoConnect: false,
        adminFabricLabel: "Gästportal Matter",
      })
      server.addCommissioningController(controller)
      await server.start()
    }

    // Bestäm bästa identifieringsdata för mDNS-sökning
    const identifierData = instanceName !== undefined
      ? { instanceName }
      : (discriminator !== undefined
          ? { longDiscriminator: parseInt(discriminator, 10) }
          : (pairingCodeCodec.shortDiscriminator !== undefined
              ? { shortDiscriminator: pairingCodeCodec.shortDiscriminator }
              : {}))

    console.log(`🧱 Matter Pairing: Driftsätter enhet med passcode ${pairingCodeCodec.passcode} och identifierare ${JSON.stringify(identifierData)}...`)
    
    // För-värm mDNS-cachen genom att skanna efter enheten i upp till 8 sekunder
    try {
      console.log('🧱 Matter Pairing: Söker efter enheten på LAN för att värma upp mDNS-cachen (8s)...')
      await controller.discoverCommissionableDevices(identifierData, undefined, undefined, 8)
    } catch (discoveryErr) {
      console.warn('⚠️ Matter Pairing: För-skanning avbröts eller misslyckades:', discoveryErr.message)
    }

    // Commissioning Options
    const commissioningOptions = {
      commissioning: {
        regulatoryLocation: 0, // Indoor
        regulatoryCountryCode: "SE",
      },
      discovery: {
        identifierData
      },
      passcode: pairingCodeCodec.passcode,
    }

    let nodeId
    try {
      nodeId = await controller.commissionNode(commissioningOptions)
    } catch (pairErr) {
      if (pairErr.message.includes('already commissioned') || pairErr.message.includes('AlreadyCommissioned')) {
        console.log('🧱 Matter Pairing: Enheten är redan driftsatt i detta fabric. Återhämtar endpoints...')
        const commissionedNodeIds = controller.getCommissionedNodes()
        const cfg = readRuntimeConfig()
        const registeredNodeIds = (cfg.matter || []).map(m => m.nodeId)
        const unregisteredNodeId = commissionedNodeIds.find(id => !registeredNodeIds.includes(id.toString()))
        if (unregisteredNodeId) {
          nodeId = unregisteredNodeId
          console.log(`🧱 Matter Pairing: Hittade oregistrerad driftsatt nod: ${nodeId}. Läser in dess endpoints...`)
        } else if (commissionedNodeIds.length > 0) {
          nodeId = commissionedNodeIds[commissionedNodeIds.length - 1]
          console.log(`🧱 Matter Pairing: Ingen oregistrerad nod hittades. Använder senaste driftsatta nod: ${nodeId}`)
        } else {
          throw new Error('Enheten är redan tillagd men kunde inte läsas in.');
        }
      } else {
        console.warn(`⚠️ Matter Pairing: Misslyckades med specifik identifierare ("${pairErr.message}"), försöker med bred sökning efter passcode...`)
        
        const fallbackOptions = {
          commissioning: commissioningOptions.commissioning,
          discovery: {
            identifierData: {} // Bred sökning efter alla oparade enheter
          },
          passcode: pairingCodeCodec.passcode,
        }
        
        // För-värm mDNS bred sökning
        try {
          await controller.discoverCommissionableDevices({}, undefined, undefined, 5)
        } catch {}

        try {
          nodeId = await controller.commissionNode(fallbackOptions)
        } catch (fallbackErr) {
          if (fallbackErr.message.includes('already commissioned') || fallbackErr.message.includes('AlreadyCommissioned')) {
            console.log('🧱 Matter Pairing Fallback: Enheten är redan driftsatt i detta fabric. Återhämtar endpoints...')
            const commissionedNodeIds = controller.getCommissionedNodes()
            const cfg = readRuntimeConfig()
            const registeredNodeIds = (cfg.matter || []).map(m => m.nodeId)
            const unregisteredNodeId = commissionedNodeIds.find(id => !registeredNodeIds.includes(id.toString()))
            if (unregisteredNodeId) {
              nodeId = unregisteredNodeId
            } else if (commissionedNodeIds.length > 0) {
              nodeId = commissionedNodeIds[commissionedNodeIds.length - 1]
            } else {
              throw new Error('Enheten är redan tillagd.');
            }
          } else {
            throw fallbackErr
          }
        }
      }
    }

    console.log(`🧱 Matter Pairing: Driftsättning lyckades! Node ID: ${nodeId}`)

    // Hämta enheten för att läsa av dess endpoints
    const node = await controller.getNode(nodeId)
    const devices = node.getDevices()

    const endpoints = devices.map(d => {
      // Kolla vilka kluster som stöds för att avgöra om det är en lampa eller uttag
      const hasOnOff = node.getClusterClientForDevice(d.number, OnOffCluster) !== undefined
      const hasLevel = node.getClusterClientForDevice(d.number, LevelControlCluster) !== undefined
      return {
        id: `matter_${nodeId}_${d.number}`,
        nodeId: nodeId.toString(),
        endpointId: d.number,
        name: `Matter Enhet ${d.number}`,
        supports_brightness: hasLevel,
        supports_color_temp: false,
        isOutlet: !hasLevel && hasOnOff // Om den bara stöder på/av men inte ljusstyrka, anta att det är ett eluttag
      }
    })

    // Spara i runtimeConfig
    const cfg = readRuntimeConfig()
    let currentMatter = cfg.matter || []
    if (!currentMatter.some(m => m.nodeId === nodeId.toString())) {
      currentMatter.push({
        nodeId: nodeId.toString(),
        code,
        endpoints
      })
    }
    updateRuntimeConfig({ matter: currentMatter })

    res.json({ ok: true, nodeId: nodeId.toString(), endpoints })
  } catch (err) {
    console.error('Matter pairing failed:', err.message)
    res.status(500).json({ error: `Parning misslyckades: ${err.message}` })
  } finally {
    if (server) {
      try { await server.close() } catch {}
    }
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/matter/lights
//  Listar alla parade Matter-endpoints.
// ──────────────────────────────────────────────────────────────
router.post('/matter/lights', async (_req, res) => {
  const { MatterBridge } = await import('./bridges/matter.js')
  const { OnOffCluster, LevelControlCluster } = await import('@project-chip/matter.js/cluster')

  let server = null
  let controller = null

  try {
    const cfg = readRuntimeConfig()
    let currentMatter = cfg.matter || []

    // Försök hämta controller från aktiv permanent eller temporär server
    if (MatterBridge.activeInstance && MatterBridge.activeInstance.controller) {
      controller = MatterBridge.activeInstance.controller
    } else {
      console.log('🧱 Matter Lights: Startar temporär server för att läsa fabric...')
      const { StorageBackendDisk } = await import('@project-chip/matter-node.js/storage')
      const { StorageManager } = await import('@project-chip/matter.js/storage')
      const { MatterServer, CommissioningController } = await import('@project-chip/matter.js')

      const storageBackend = new StorageBackendDisk('server/data/matter-store')
      const storageManager = new StorageManager(storageBackend)
      await storageManager.initialize()

      server = new MatterServer(storageManager)
      controller = new CommissioningController({
        autoConnect: true, // Auto-anslut till existerande noder
        adminFabricLabel: "Gästportal Matter",
      })
      server.addCommissioningController(controller)
      await server.start()

      // Vänta kort på att mDNS-anslutningar ska etableras
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    if (controller) {
      const commissionedNodeIds = controller.getCommissionedNodes()
      console.log('🧱 Matter Lights: Hittade driftsatta noder i fabric:', commissionedNodeIds.map(id => id.toString()))

      let configChanged = false

      for (const nodeId of commissionedNodeIds) {
        const nodeStr = nodeId.toString()
        if (!currentMatter.some(m => m.nodeId === nodeStr)) {
          console.log(`🧱 Matter Lights: Upptäckte oregistrerad driftsatt nod ${nodeStr}. Återhämtar endpoints...`)
          try {
            const node = await controller.getNode(nodeId)
            const devices = node.getDevices()

            const endpoints = devices.map(d => {
              const hasOnOff = node.getClusterClientForDevice(d.number, OnOffCluster) !== undefined
              const hasLevel = node.getClusterClientForDevice(d.number, LevelControlCluster) !== undefined
              return {
                id: `matter_${nodeStr}_${d.number}`,
                nodeId: nodeStr,
                endpointId: d.number,
                name: `Matter Enhet ${d.number}`,
                supports_brightness: hasLevel,
                supports_color_temp: false,
                isOutlet: !hasLevel && hasOnOff
              }
            })

            currentMatter.push({
              nodeId: nodeStr,
              code: 'RECOVERED',
              endpoints
            })
            configChanged = true
          } catch (nodeErr) {
            console.warn(`⚠️ Kunde inte läsa in enhet ${nodeStr} just nu (kanske offline):`, nodeErr.message)
          }
        }
      }

      if (configChanged) {
        updateRuntimeConfig({ matter: currentMatter })
      }
    }

    // Skapa listan med alla endpoints
    const allEndpoints = []
    for (const device of currentMatter) {
      for (const ep of device.endpoints) {
        allEndpoints.push({
          id: ep.id,
          nodeId: ep.nodeId,
          endpointId: ep.endpointId,
          name: ep.name,
          supports_brightness: ep.supports_brightness,
          supports_color_temp: ep.supports_color_temp || false,
          isOutlet: ep.isOutlet
        })
      }
    }

    res.json({ lights: allEndpoints })
  } catch (err) {
    console.error('Matter lights retrieval failed:', err.message)
    res.status(500).json({ error: `Kunde inte hämta Matter-lampor: ${err.message}` })
  } finally {
    if (server) {
      try { await server.close() } catch {}
    }
  }
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/save
//  Sparar hela konfigurationen och markerar setup som klar.
//  Body: { cast: [{ip, name}], info: {...}, lights: [...], scenes: [...], rooms: [...] }
// ──────────────────────────────────────────────────────────────
router.post('/save', (req, res) => {
  const { cast, info, lights, media_players, scenes, matter, rooms } = req.body

  updateRuntimeConfig({
    setupComplete: true,
    cast:          cast         ?? [],
    info:          info         ?? {},
    lights:        lights       ?? [],
    media_players: media_players ?? [],
    scenes:        scenes       ?? [],
    rooms:         rooms        ?? [],
    ...(matter && { matter }),
  })

  res.json({ ok: true })
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/import
//  Importerar och skriver över en hel systemkonfiguration.
// ──────────────────────────────────────────────────────────────
router.post('/import', (req, res) => {
  const config = req.body
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: 'Ogiltig systemkonfiguration' })
  }

  // Säkerställ att setupComplete markeras så att portalen laddar broar vid omstart
  config.setupComplete = true

  writeRuntimeConfig(config)
  res.json({ ok: true })
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/reset
//  Nollställer konfigurationen så att wizarden visas igen.
//  Användbart om du byter Bridge eller vill konfigurera om.
// ──────────────────────────────────────────────────────────────
router.post('/reset', (_req, res) => {
  const cfg = readRuntimeConfig()
  writeRuntimeConfig({ ...cfg, setupComplete: false })
  res.json({ ok: true })
})

// ──────────────────────────────────────────────────────────────
//  POST /api/setup/factory-reset
//  Fabriksåterställer hela systemet till noll.
// ──────────────────────────────────────────────────────────────
router.post('/factory-reset', (_req, res) => {
  console.log('🧹 [FACTORY RESET] Återställer gästportalen till noll...')
  writeRuntimeConfig(DEFAULT_CONFIG)

  // Ta bort matter-store databasen
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const ROOT = join(__dirname, '..')
  const matterStorePath = join(ROOT, 'server/data/matter-store')
  if (existsSync(matterStorePath)) {
    try {
      rmSync(matterStorePath, { recursive: true, force: true })
      console.log('🧹 [FACTORY RESET] Tog bort matter-store databasen.')
    } catch (err) {
      console.error('⚠️ [FACTORY RESET] Kunde inte ta bort matter-store:', err.message)
    }
  }

  res.json({ ok: true })
})

export default router

