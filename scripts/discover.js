#!/usr/bin/env node
// ============================================================
//  Discovery Script – Hitta enhets-ID:n för Hue och IKEA
//  Fil: scripts/discover.js
//
//  Kör med: npm run discover
//
//  Det här scriptet hjälper dig att:
//  1. Skapa ett API-konto på Philips Hue Bridge
//  2. Lista alla Hue-lampors UUID:n
//  3. Para ihop med IKEA Dirigera och lista enheters UUID:n
//  4. Kopiera UUID:n till config.json
// ============================================================

import { Agent, fetch } from 'undici'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
dotenv.config({ path: join(ROOT, '.env') })

const agent = new Agent({ connect: { rejectUnauthorized: false } })

// ── Hjälpfunktioner ───────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(q, resolve))
const hr = () => console.log('\n' + '─'.repeat(60) + '\n')

function updateEnv(key, value) {
  const envPath = join(ROOT, '.env')
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''
  const regex = new RegExp(`^${key}=.*`, 'm')
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
  } else {
    content += `\n${key}=${value}`
  }
  writeFileSync(envPath, content)
  console.log(`✅ Sparade ${key} i .env`)
}

// ────────────────────────────────────────────────────────────
//  PHILIPS HUE
// ────────────────────────────────────────────────────────────
async function discoverHue() {
  console.log('\n💡 PHILIPS HUE BRIDGE\n')

  let ip = process.env.HUE_BRIDGE_IP
  if (!ip || ip.includes('XX')) {
    // Försök hitta bryggan automatiskt via Hue Discovery API
    console.log('🔍 Söker efter Hue Bridge på nätverket...')
    try {
      const res  = await fetch('https://discovery.meethue.com/')
      const data = await res.json()
      if (data.length > 0) {
        ip = data[0].internalipaddress
        console.log(`   Hittade Hue Bridge: ${ip}`)
        updateEnv('HUE_BRIDGE_IP', ip)
      }
    } catch {
      ip = await ask('Kunde inte hitta Bridge automatiskt. Ange IP manuellt: ')
      updateEnv('HUE_BRIDGE_IP', ip)
    }
  } else {
    console.log(`   Använder HUE_BRIDGE_IP från .env: ${ip}`)
  }

  let apiKey = process.env.HUE_API_KEY
  if (!apiKey) {
    console.log('\n   För att skapa ett API-konto:')
    console.log('   1. Tryck på den STORA KNAPPEN på din Hue Bridge')
    await ask('   2. Tryck Enter när du har tryckt på knappen... ')

    try {
      const res  = await fetch(`https://${ip}/api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devicetype: 'gastportal#server', generateclientkey: true }),
        dispatcher: agent,
      })
      const data = await res.json()
      if (data[0]?.success?.username) {
        apiKey = data[0].success.username
        updateEnv('HUE_API_KEY', apiKey)
      } else if (data[0]?.error?.description) {
        console.error('❌ Hue-fel:', data[0].error.description)
        return
      }
    } catch (err) {
      console.error('❌ Kunde inte ansluta till Hue Bridge:', err.message)
      return
    }
  } else {
    console.log(`   Använder befintlig HUE_API_KEY`)
  }

  // Lista alla lampor
  console.log('\n📋 Hue-lampor (kopiera bridge_id till config.json):\n')
  try {
    const res  = await fetch(`https://${ip}/clip/v2/resource/light`, {
      headers: { 'hue-application-key': apiKey },
      dispatcher: agent,
    })
    const { data } = await res.json()

    const col = (s, w) => s.toString().padEnd(w)
    console.log(col('Namn', 30) + col('Rum', 20) + 'bridge_id (UUID)')
    console.log('─'.repeat(80))
    for (const l of data) {
      console.log(
        col(l.metadata?.name ?? '?', 30) +
        col(l.owner?.rtype ?? '?', 20) +
        l.id
      )
    }
  } catch (err) {
    console.error('❌ Kunde inte hämta lampor:', err.message)
  }
}

// ────────────────────────────────────────────────────────────
//  IKEA DIRIGERA
// ────────────────────────────────────────────────────────────
async function discoverIkea() {
  console.log('\n\n🏮 IKEA DIRIGERA HUB\n')

  let ip = process.env.IKEA_HUB_IP
  if (!ip || ip.includes('XX')) {
    ip = await ask('Ange IP-adress till din IKEA Dirigera-hubb: ')
    updateEnv('IKEA_HUB_IP', ip)
  } else {
    console.log(`   Använder IKEA_HUB_IP från .env: ${ip}`)
  }

  let token = process.env.IKEA_TOKEN
  if (!token) {
    console.log('\n   Autentisering mot IKEA Dirigera:')
    console.log('   1. Ha den NIO-SIFFRIGA KODEN redo (finns på undersidan av hubben)')
    const code = await ask('   2. Ange koden: ')

    // PKCE-flöde krävs av Dirigera
    console.log('\n   Genererar PKCE code verifier...')
    const { randomBytes, createHash } = await import('crypto')
    const verifier  = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')

    try {
      // Steg 1: Hämta auth-kod
      const authRes = await fetch(
        `https://${ip}:8443/v1/oauth/authorize?` +
        `audience=homesmart.local&response_type=code` +
        `&code_challenge=${challenge}&code_challenge_method=S256`,
        {
          method: 'GET',
          headers: { Authorization: `Basic ${Buffer.from(`:${code}`).toString('base64')}` },
          dispatcher: agent,
        }
      )
      const { code: authCode } = await authRes.json()

      // Steg 2: Byt auth-kod mot access token
      const tokenRes = await fetch(`https://${ip}:8443/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          code_verifier: verifier,
        }),
        dispatcher: agent,
      })
      const { access_token } = await tokenRes.json()
      token = access_token
      updateEnv('IKEA_TOKEN', token)
    } catch (err) {
      console.error('❌ IKEA-autentisering misslyckades:', err.message)
      return
    }
  } else {
    console.log(`   Använder befintlig IKEA_TOKEN`)
  }

  // Lista alla lampor
  console.log('\n📋 IKEA-enheter (kopiera bridge_id till config.json):\n')
  try {
    const res    = await fetch(`https://${ip}:8443/v1/lights`, {
      headers: { Authorization: `Bearer ${token}` },
      dispatcher: agent,
    })
    const lights = await res.json()

    const col = (s, w) => s.toString().padEnd(w)
    console.log(col('Namn', 35) + 'bridge_id (UUID)')
    console.log('─'.repeat(80))
    for (const l of lights) {
      console.log(col(l.attributes?.customName ?? l.id, 35) + l.id)
    }
  } catch (err) {
    console.error('❌ Kunde inte hämta IKEA-enheter:', err.message)
  }
}

// ────────────────────────────────────────────────────────────
//  GOVEE – Ingen discovery, bara API-nyckel
// ────────────────────────────────────────────────────────────
async function discoverGovee() {
  const apiKey = process.env.GOVEE_API_KEY
  if (!apiKey) {
    console.log('\n🌈 GOVEE\n')
    console.log('   Govee kräver en API-nyckel från Govee Developer Portal.')
    console.log('   1. Gå till: https://developer.govee.com')
    console.log('   2. Skapa ett konto och begär en API-nyckel')
    console.log('   3. Lägg till nyckeln i .env under GOVEE_API_KEY=')
    return
  }

  console.log('\n🌈 GOVEE-enheter:\n')
  try {
    const res    = await fetch('https://developer-api.govee.com/v1/devices', {
      headers: { 'Govee-API-Key': apiKey },
    })
    const { data } = await res.json()

    const col = (s, w) => s.toString().padEnd(w)
    console.log(col('Namn', 30) + col('Modell', 20) + 'bridge_id (device)')
    console.log('─'.repeat(80))
    for (const d of data.devices ?? []) {
      console.log(col(d.deviceName, 30) + col(d.model, 20) + d.device)
    }
  } catch (err) {
    console.error('❌ Govee API-fel:', err.message)
  }
}

// ── Kör discovery ─────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════╗')
console.log('║        Gästportal – Enhets-Discovery Script          ║')
console.log('╚══════════════════════════════════════════════════════╝')

await discoverHue()
hr()
await discoverIkea()
hr()
await discoverGovee()

console.log('\n✅ Discovery klar!')
console.log('   Kopiera UUID:na ovan och ersätt REPLACE_WITH_... i config.json\n')
rl.close()
