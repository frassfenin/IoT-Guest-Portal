import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import Header from './components/Header.jsx'
import SceneGrid from './components/SceneGrid.jsx'
import LightCard from './components/LightCard.jsx'
import MediaCard from './components/MediaCard.jsx'
import InfoPage from './components/InfoPage.jsx'
import SetupWizard from './components/setup/SetupWizard.jsx'
import RoomOrganizer from './components/RoomOrganizer.jsx'

// ──────────────────────────────────────────
//  Socket.io-klient
//  I dev-läge proxas detta via Vite till :3001
// ──────────────────────────────────────────
const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })

// Gruppera lampor per rum
function groupByRoom(lights) {
  return lights.reduce((acc, light) => {
    const room = light.room || 'Övrigt'
    if (!acc[room]) acc[room] = []
    acc[room].push(light)
    return acc
  }, {})
}

export default function App() {
  const [tab, setTab]         = useState('home')
  const [config, setConfig]   = useState(null)
  const [states, setStates]   = useState({}) // entity_id → state-objekt
  const [connected, setConnected] = useState(false)
  const [error, setError]     = useState(null)
  const [setupNeeded, setSetupNeeded] = useState(null)
  const [showSettingsHub, setShowSettingsHub] = useState(false)
  const [showOrganizer, setShowOrganizer] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  const handleSaveRooms = useCallback(async (updatedLights) => {
    if (!config) return
    const updatedConfig = {
      ...config,
      lights: updatedLights
    }

    try {
      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedConfig,
          cast: updatedConfig.cast || config.cast || []
        })
      })

      if (!res.ok) throw new Error('Kunde inte spara rumskonfigurationen')

      setShowOrganizer(false)
      socket.emit('setup_complete')
      setConfig(updatedConfig)
    } catch (err) {
      console.error('Kunde inte spara rumskonfiguration:', err)
      alert('Kunde inte spara ändringarna. Kontrollera anslutningen till servern.')
    }
  }, [config])

  const loadPortal = useCallback(() => {
    Promise.all([
      fetch('/api/config').then((r) => r.json()),
      fetch('/api/states').then((r) => r.json()),
    ])
      .then(([cfg, stateList]) => {
        setConfig(cfg)
        const stateMap = {}
        stateList.forEach((s) => { stateMap[s.entity_id] = s })
        setStates(stateMap)
        setError(null)
      })
      .catch((err) => {
        console.error('Kunde inte hämta konfiguration:', err)
        setError('Kunde inte ansluta till servern. Kontrollera nätverksanslutningen.')
      })
  }, [])

  // ── Hämta konfiguration och setup-status ──────────────────
  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        setSetupNeeded(data.setupNeeded)
        if (!data.setupNeeded) {
          loadPortal()
        }
      })
      .catch((err) => {
        console.error('Kunde inte läsa setup status:', err)
        setError('Kunde inte ansluta till servern. Kontrollera att backend körs.')
      })
  }, [loadPortal])

  // ── Realtidsuppdateringar via Socket.io ─────────────────
  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('state_changed', ({ entity_id, state }) => {
      setStates((prev) => ({ ...prev, [entity_id]: state }))
    })
    socket.on('reload', () => {
      console.log('⚙️ Serverkonfiguration ändrad – laddar om...')
      fetch('/api/setup/status')
        .then((r) => r.json())
        .then((data) => {
          setSetupNeeded(data.setupNeeded)
          if (!data.setupNeeded) {
            loadPortal()
          }
        })
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('state_changed')
      socket.off('reload')
    }
  }, [loadPortal])

  // ── Hjälpfunktion: anropa API och uppdatera lokal state ──
  const apiCall = useCallback(async (path, body) => {
    try {
      await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      console.error('API-fel:', err)
    }
  }, [])

  // ── Lampstyrning ─────────────────────────────────────────
  const controlLight = useCallback((entity_id, changes) => {
    // Optimistisk uppdatering – UI reagerar direkt
    setStates((prev) => ({
      ...prev,
      [entity_id]: {
        ...prev[entity_id],
        state: changes.state ?? prev[entity_id]?.state,
        attributes: {
          ...prev[entity_id]?.attributes,
          ...(changes.brightness !== undefined && { brightness: changes.brightness }),
          ...(changes.color_temp !== undefined && { color_temp: changes.color_temp }),
        },
      },
    }))
    apiCall(`/api/light/${entity_id}`, changes)
  }, [apiCall])

  // ── Scenaktivering ───────────────────────────────────────
  const activateScene = useCallback((entity_id, transition) => {
    apiCall(`/api/scene/${entity_id}`, { transition })
  }, [apiCall])

  // ── Mediakontroll ────────────────────────────────────────
  const controlMedia = useCallback((entity_id, action, volume) => {
    // Optimistisk uppdatering av volym
    if (action === 'volume_set') {
      setStates((prev) => ({
        ...prev,
        [entity_id]: {
          ...prev[entity_id],
          attributes: { ...prev[entity_id]?.attributes, volume_level: volume },
        },
      }))
    }
    apiCall(`/api/media/${entity_id}`, { action, volume })
  }, [apiCall])

  const handleSetupComplete = useCallback(() => {
    setSetupNeeded(false)
    socket.emit('setup_complete')
  }, [])

  // ── Render ───────────────────────────────────────────────
  if (setupNeeded === null && !error) {
    return (
      <>
        <div className="app-bg" />
        <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      </>
    )
  }

  if (setupNeeded === true) {
    return (
      <>
        <div className="app-bg" />
        <div className="app">
          {error && (
            <div className="status-banner status-banner--error" role="alert">
              ⚠️ {error}
            </div>
          )}
          <SetupWizard onComplete={handleSetupComplete} />
        </div>
      </>
    )
  }

  if (!config && !error) {
    return (
      <>
        <div className="app-bg" />
        <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      </>
    )
  }

  const roomGroups = config ? groupByRoom(config.lights) : {}

  return (
    <>
      <div className="app-bg" />
      <div className="app">
        <div className="portal-header">
          <Header 
            connected={connected} 
            onOpenOrganizer={() => setShowSettingsHub(true)} 
          />
        </div>

        {error && (
          <div className="status-banner status-banner--error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {!error && config && (
          <div className="portal-grid">
            {/* ── Left Column / Info Panel ── */}
            <section
              id="main-info"
              className={`portal-col portal-col--info ${tab === 'info' ? 'portal-col--active' : ''}`}
              aria-label="Information och WiFi"
            >
              <InfoPage info={config.info} />
            </section>

            {/* ── Right Column / Controls Cockpit ── */}
            <section
              id="main-home"
              className={`portal-col portal-col--controls ${tab === 'home' ? 'portal-col--active' : ''}`}
              aria-label="Belysning och scener"
            >
              {/* Snabbscener */}
              <div className="controls-group controls-group--scenes">
                <div className="section-header">
                  <span className="section-header__title">Scener</span>
                  <div className="section-header__line" />
                </div>
                <SceneGrid
                  scenes={config.scenes}
                  onActivate={activateScene}
                />
              </div>

              {/* Belysning per rum */}
              <div className="controls-group controls-group--lights">
                <div className="section-header">
                  <span className="section-header__title">Belysning</span>
                  <div className="section-header__line" />
                </div>
                <div className="rooms-grid">
                  {Object.entries(roomGroups).map(([room, lights]) => (
                    <div key={room} className="room-section" style={{ marginBottom: 'var(--space-4)' }}>
                      <p className="text-xs text-dim font-semibold"
                         style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        {room}
                      </p>
                      {lights.map((light) => (
                        <LightCard
                          key={light.entity_id}
                          config={light}
                          state={states[light.entity_id]}
                          onChange={controlLight}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Media */}
              {config.media_players.length > 0 && (
                <div className="controls-group controls-group--media">
                  <div className="section-header">
                    <span className="section-header__title">Media</span>
                    <div className="section-header__line" />
                  </div>
                  {config.media_players.map((player) => (
                    <MediaCard
                      key={player.entity_id}
                      config={player}
                      state={states[player.entity_id]}
                      onControl={controlMedia}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Tab-bar ──────────────────────────────────────── */}
        <nav className="tab-bar" role="navigation" aria-label="Sidonavigering">
          <button
            id="tab-home"
            className={`tab-btn ${tab === 'home' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('home')}
            aria-current={tab === 'home' ? 'page' : undefined}
          >
            <span className="tab-btn__icon">🏠</span>
            Hem
          </button>
          <button
            id="tab-info"
            className={`tab-btn ${tab === 'info' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('info')}
            aria-current={tab === 'info' ? 'page' : undefined}
          >
            <span className="tab-btn__icon">ℹ️</span>
            Info
          </button>
        </nav>

        {/* ── Room Organizer Modal ── */}
        {showOrganizer && config && (
          <RoomOrganizer
            config={config}
            onSave={handleSaveRooms}
            onClose={() => setShowOrganizer(false)}
          />
        )}

        {/* ── Settings Hub Selector Modal ── */}
        {showSettingsHub && (
          <div className="settings-hub-overlay" role="dialog" aria-modal="true" aria-labelledby="hub-title">
            <div className="settings-hub-canvas fade-in">
              <div className="settings-hub-header">
                <h2 id="hub-title">Inställningar & Administration</h2>
                <button className="setup-btn setup-btn--secondary" onClick={() => setShowSettingsHub(false)}>✕ Stäng</button>
              </div>
              <p className="settings-hub-desc">Välj vad du vill konfigurera eller organisera i din gästportal.</p>
              
              <div className="settings-hub-options">
                {/* Option 1: Room organizer (Kanban drag-and-drop) */}
                <div 
                  className="settings-hub-card" 
                  onClick={() => {
                    setShowSettingsHub(false)
                    setShowOrganizer(true)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && (setShowSettingsHub(false) || setShowOrganizer(true))}
                >
                  <div className="settings-hub-card__icon">🏠</div>
                  <div className="settings-hub-card__content">
                    <h3>Organisera rum</h3>
                    <p>Dra och släpp lampor för att ändra deras rumsplacering, skapa egna rum och sortera portalen.</p>
                  </div>
                </div>

                {/* Option 2: Setup wizard in edit mode */}
                <div 
                  className="settings-hub-card" 
                  onClick={() => {
                    setShowSettingsHub(false)
                    setShowSetupWizard(true)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && (setShowSettingsHub(false) || setShowSetupWizard(true))}
                >
                  <div className="settings-hub-card__icon">⚙️</div>
                  <div className="settings-hub-card__content">
                    <h3>Konfigurera enheter</h3>
                    <p>Lägg till nya lampor (Hue, IKEA, Govee, Matter, Cast-enheter), ändra parningar, WiFi-lösenord eller anteckningar.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Setup Wizard Modal (Edit Mode) ── */}
        {showSetupWizard && config && (
          <div className="setup-wizard-overlay">
            <SetupWizard
              initialConfig={config}
              onComplete={() => {
                setShowSetupWizard(false)
                socket.emit('setup_complete')
              }}
              onCancel={() => setShowSetupWizard(false)}
            />
          </div>
        )}
      </div>
    </>
  )
}
