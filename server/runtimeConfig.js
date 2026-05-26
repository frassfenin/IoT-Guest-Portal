// ============================================================
//  Runtime Configuration – Läs och skriv runtime-config.json
//  Fil: server/runtimeConfig.js
//
//  Lagrar bridge-credentials och konfiguration i en lokal
//  JSON-fil (runtime-config.json) som aldrig committas till git.
//  Om filen saknas returneras ett default-objekt med
//  setupComplete: false.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname  = dirname(fileURLToPath(import.meta.url))
export const CONFIG_PATH = join(__dirname, '..', 'runtime-config.json')

export const DEFAULT_CONFIG = {
  setupComplete: false,
  hue:       { ip: '', apiKey: '' },
  ikea:      { ip: '', token:  '' },
  govee:     { apiKey: '' },
  matter:    [],
  cast:      [],                   // [{ name, ip }]
  lights:    [],                   // Kopieras från config.json efter setup
  media_players: [],
  scenes:    [],
  info: {
    wifiName:     '',
    wifiPassword: '',
    notes:        [],
  },
}

// ── Läs konfiguration ─────────────────────────────────────────
export function readRuntimeConfig() {
  if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_CONFIG)
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  } catch (err) {
    console.error('Kunde inte läsa runtime-config.json:', err.message)
    return structuredClone(DEFAULT_CONFIG)
  }
}

// ── Skriv konfiguration ───────────────────────────────────────
export function writeRuntimeConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// ── Merge och uppdatera delar av konfigurationen ─────────────
export function updateRuntimeConfig(partial) {
  const current = readRuntimeConfig()
  const updated = deepMerge(current, partial)
  writeRuntimeConfig(updated)
  return updated
}

// ── Hjälp: Djup merge av objekt (utan att radera nycklar) ────
function deepMerge(base, override) {
  const result = { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object') {
      result[k] = deepMerge(base[k], v)
    } else {
      result[k] = v
    }
  }
  return result
}

export function isSetupComplete() {
  return readRuntimeConfig().setupComplete === true
}
