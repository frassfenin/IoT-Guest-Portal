import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, Wifi, FileText, Info, Lightbulb, LightbulbOff, Copy, Check, Loader2 } from 'lucide-react'
import { io } from 'socket.io-client'
import QRCode from 'qrcode'
import Header from './components/Header.jsx'
import SceneGrid from './components/SceneGrid.jsx'
import LightCard from './components/LightCard.jsx'
import MediaCard from './components/MediaCard.jsx'
import InfoPage from './components/InfoPage.jsx'
import SetupWizard from './components/setup/SetupWizard.jsx'
import RoomOrganizer from './components/RoomOrganizer.jsx'
import useClickOutside from './hooks/useClickOutside.js'
import { copyToClipboard } from './utils/clipboard.js'
import { POPOVER_TYPES, LOCALE_STORAGE_KEY } from './constants.js'
import sv from './components/languages/sv.js'
import en from './components/languages/en.js'

const locales = { sv, en }

// ──────────────────────────────────────────
//  Socket.io-klient
//  I dev-läge proxas detta via Vite till :3001
// ──────────────────────────────────────────
const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })

// Gruppera lampor per rum
function groupByRoom(lights, defaultRoomName = 'Other') {
  return lights.reduce((acc, light) => {
    const room = light.room || defaultRoomName
    if (!acc[room]) acc[room] = []
    acc[room].push(light)
    return acc
  }, {})
}

export default function App() {
  const [locale, setLocale] = useState(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    return saved === 'en' ? 'en' : 'sv'
  })

  const t = useCallback((key, replaces = {}) => {
    let str = locales[locale]?.[key] || locales['sv']?.[key] || key
    Object.entries(replaces).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
    return str
  }, [locale])

  const [config, setConfig]   = useState(null)
  const [states, setStates]   = useState({}) // entity_id → state-objekt
  const [connected, setConnected] = useState(false)
  const [error, setError]     = useState(null)
  const [setupNeeded, setSetupNeeded] = useState(null)
  const [showOrganizer, setShowOrganizer] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [activePopover, setActivePopover] = useState(null) // null | 'wifi' | 'notes' | 'status'
  const [qrMode, setQrMode] = useState('wifi') // 'wifi' | 'portal'
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [blurEnabled, setBlurEnabled] = useState(() => {
    const saved = localStorage.getItem('guest_portal_blur_enabled')
    return saved !== 'false' // Standardmässigt AKTIVERAD (true)
  })

  // Toggle för suddig bakgrund med LocalStorage-lagring
  const toggleBlur = useCallback(() => {
    setBlurEnabled((prev) => {
      const newVal = !prev
      localStorage.setItem('guest_portal_blur_enabled', String(newVal))
      return newVal
    })
  }, [])


  const dockRef = useRef(null)

  useClickOutside(dockRef, () => setActivePopover(null))

  // Generera QR-kod
  useEffect(() => {
    if (activePopover === 'wifi' && config?.info) {
      const text = qrMode === 'wifi'
        ? `WIFI:S:${config.info.wifi_name};T:WPA;P:${config.info.wifi_password};;`
        : window.location.origin;

      QRCode.toDataURL(text, {
        width: 180,
        margin: 1,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Kunde inte generera QR-kod:', err))
    } else {
      setQrDataUrl('')
    }
  }, [activePopover, qrMode, config])

  // WiFi-kopiering till urklipp
  const handleWifiCopy = useCallback(async () => {
    if (!config?.info?.wifi_password) return
    await copyToClipboard(config.info.wifi_password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [config])


  const handleSaveRooms = useCallback(async (updatedLights, updatedRooms) => {
    if (!config) return
    const updatedConfig = {
      ...config,
      lights: updatedLights,
      rooms: updatedRooms
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

      if (!res.ok) throw new Error(t('save_failed_msg'))

      setShowOrganizer(false)
      socket.emit('setup_complete')
      setConfig(updatedConfig)
    } catch (err) {
      console.error('Kunde inte spara rumskonfiguration:', err)
      alert(t('save_failed_connection'))
    }
  }, [config, t])


  const loadPortal = useCallback(() => {
    // Sync locale from localStorage
    const saved = localStorage.getItem('setup_wizard_locale')
    setLocale(saved === 'en' ? 'en' : 'sv')

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
        setError(t('connect_server_failed'))
      })
  }, [t])

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
        setError(t('check_backend_failed'))
      })
  }, [loadPortal, t])

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

  // ── Master-kontroll för alla lampor (på / av) ──────────
  const toggleAllLights = useCallback((state) => {
    if (!config?.lights) return
    config.lights.forEach((light) => {
      controlLight(light.entity_id, { state })
    })
  }, [config, controlLight])

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
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    setLocale(saved === 'en' ? 'en' : 'sv')
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
        <div className="app-bg">
          <div className="bg-blob bg-blob--sage" />
          <div className="bg-blob bg-blob--sand" />
          <div className="bg-blob bg-blob--blue" />
          <div className="bg-blob bg-blob--purple" />
        </div>
        <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      </>
    )
  }

  const roomGroups = config ? groupByRoom(config.lights, t('other_room')) : {}

  return (
    <>
      <div className="app-bg">
        <div className="bg-blob bg-blob--sage" />
        <div className="bg-blob bg-blob--sand" />
        <div className="bg-blob bg-blob--blue" />
        <div className="bg-blob bg-blob--purple" />
      </div>
      <div className="app">
        <div className="portal-header">
          <Header 
            connected={connected} 
            config={config}
            onOpenOrganizer={() => setShowOrganizer(true)} 
            onOpenSetupWizard={() => setShowSetupWizard(true)}
            blurEnabled={blurEnabled}
            onToggleBlur={toggleBlur}
            locale={locale}
            t={t}
          />
        </div>

        {error && (
          <div className="status-banner status-banner--error" role="alert">
            ⚠️ {error}
          </div>
        )}
        {!error && config && (
          <div className={`portal-grid ${activePopover && blurEnabled ? 'content-blurred' : ''}`}>
            {/* ── Huvudyta / Kontrollpanel ── */}
            <section
              id="main-home"
              className="portal-col portal-col--controls"
              aria-label="Belysning och scener"
            >
              {/* Belysning per rum */}
              <div className="controls-group controls-group--lights">
                <div className="section-header">
                  <span className="section-header__title">{t('lights_title')}</span>
                  <div className="section-header__line" />
                </div>
                <div className="rooms-grid">
                  {Object.entries(roomGroups)
                    .sort(([roomA], [roomB]) => {
                      if (roomA === t('other_room')) return 1
                      if (roomB === t('other_room')) return -1
                      const savedRooms = config.rooms || []
                      const idxA = savedRooms.indexOf(roomA)
                      const idxB = savedRooms.indexOf(roomB)
                      if (idxA === -1 && idxB === -1) return roomA.localeCompare(roomB)
                      if (idxA === -1) return 1
                      if (idxB === -1) return -1
                      return idxA - idxB
                    })
                    .map(([room, lights]) => (
                      <div key={room} className="room-section" style={{ marginBottom: 'var(--space-4)' }}>
                        <p className="text-xs text-dim font-semibold"
                           style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, color: 'var(--text-2)' }}>
                          {room}
                        </p>
                        <div className="room-lights-grid">
                          {lights.map((light) => (
                            <LightCard
                              key={light.entity_id}
                              config={light}
                              state={states[light.entity_id]}
                              onChange={controlLight}
                              t={t}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Media */}
              {config.media_players.length > 0 && (
                <div className="controls-group controls-group--media">
                  <div className="section-header">
                    <span className="section-header__title">{t('media_title')}</span>
                    <div className="section-header__line" />
                  </div>
                  {config.media_players.map((player) => (
                    <MediaCard
                      key={player.entity_id}
                      config={player}
                      state={states[player.entity_id]}
                      onControl={controlMedia}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Flytande Bottenmeny (Dock-bar) ── */}
        {config && (
          <div className="floating-dock-container" ref={dockRef}>
            <div className="floating-dock">
              {/* Scener-knapp */}
              <button
                type="button"
                className={`floating-dock__btn ${activePopover === 'scenes' ? 'floating-dock__btn--active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'scenes' ? null : 'scenes')}
                title={t('scenes_title')}
              >
                <Sparkles size={20} style={{ strokeWidth: 2.2 }} />
                {activePopover === 'scenes' && (
                  <div className="dock-popover scenes-popover" onClick={(e) => e.stopPropagation()}>
                    <div className="section-header">
                      <span className="section-header__title">{t('master_switch_title')}</span>
                    </div>
                    <div className="scenes-popover__master-controls">
                      <button 
                        type="button" 
                        className="master-btn master-btn--on"
                        onClick={() => toggleAllLights('on')}
                      >
                        <Lightbulb size={15} style={{ strokeWidth: 2.5 }} />
                        {t('turn_all_on_btn')}
                      </button>
                      <button 
                        type="button" 
                        className="master-btn master-btn--off"
                        onClick={() => toggleAllLights('off')}
                      >
                        <LightbulbOff size={15} style={{ strokeWidth: 2.5 }} />
                        {t('turn_all_off_btn')}
                      </button>
                    </div>

                    <div className="scenes-popover__divider" />

                    <div className="section-header" style={{ marginTop: '4px' }}>
                      <span className="section-header__title">{t('select_scene_title')}</span>
                    </div>
                    <SceneGrid
                      scenes={config.scenes}
                      onActivate={activateScene}
                    />
                  </div>
                )}
              </button>

              {/* WiFi-knapp */}
              <button
                type="button"
                className={`floating-dock__btn ${activePopover === 'wifi' ? 'floating-dock__btn--active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'wifi' ? null : 'wifi')}
                title={t('wifi_info_title')}
              >
                <Wifi size={20} style={{ strokeWidth: 2.2 }} />
                {activePopover === 'wifi' && (
                  <div className="dock-popover wifi-popover" onClick={(e) => e.stopPropagation()}>
                    <div className="section-header">
                      <span className="section-header__title">{t('wifi_guest_portal_title')}</span>
                    </div>

                    {/* Flikväljare för WiFi / Portal */}
                    <div className="wifi-popover__tabs">
                      <button
                        type="button"
                        className={`wifi-popover__tab ${qrMode === 'wifi' ? 'wifi-popover__tab--active' : ''}`}
                        onClick={() => setQrMode('wifi')}
                      >
                        <Wifi size={13} style={{ marginRight: '6px' }} />
                        {t('connect_wifi_tab')}
                      </button>
                      <button
                        type="button"
                        className={`wifi-popover__tab ${qrMode === 'portal' ? 'wifi-popover__tab--active' : ''}`}
                        onClick={() => setQrMode('portal')}
                      >
                        <Sparkles size={13} style={{ marginRight: '6px' }} />
                        {t('open_portal_tab')}
                      </button>
                    </div>

                    {qrMode === 'wifi' ? (
                      <>
                        <div className="wifi-field">
                          <span className="wifi-field__label">{t('network_label')}</span>
                          <span className="wifi-field__value">{config.info.wifi_name}</span>
                        </div>
                        <div className="wifi-field">
                          <span className="wifi-field__label">{t('password_label')}</span>
                          <span className="wifi-field__value">{config.info.wifi_password}</span>
                        </div>
                        <div className="wifi-card__copy-hint" onClick={handleWifiCopy}>
                          {copied ? (
                            <>
                              <Check size={14} style={{ strokeWidth: 2.5, color: '#ffffff', marginRight: '6px' }} />
                              {t('pwd_copied_status')}
                            </>
                          ) : (
                            <>
                              <Copy size={14} style={{ strokeWidth: 2.2, marginRight: '6px' }} />
                              {t('copy_password_btn')}
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="wifi-field">
                          <span className="wifi-field__label">{t('address_label')}</span>
                          <span className="wifi-field__value" style={{ fontSize: '0.85rem' }}>
                            {window.location.origin}
                          </span>
                        </div>
                        <div className="wifi-field">
                          <span className="wifi-field__label">{t('status_label')}</span>
                          <span className="wifi-field__value">{t('status_local_connected')}</span>
                        </div>
                        <div 
                          className="wifi-card__copy-hint" 
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                        >
                          {copied ? (
                            <>
                              <Check size={14} style={{ strokeWidth: 2.5, color: '#ffffff', marginRight: '6px' }} />
                              {t('link_copied_status')}
                            </>
                          ) : (
                            <>
                              <Copy size={14} style={{ strokeWidth: 2.2, marginRight: '6px' }} />
                              {t('copy_link_btn')}
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* QR-kod Generator */}
                    <div className="wifi-popover__qr-container">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code" className="wifi-popover__qr-image" />
                      ) : (
                        <div className="wifi-popover__qr-placeholder">
                          <Loader2 size={24} className="wifi-popover__qr-spinner" />
                        </div>
                      )}
                      <p className="wifi-popover__qr-tip">
                        {qrMode === 'wifi' 
                          ? t('scan_connect_wifi') 
                          : t('scan_open_portal')}
                      </p>
                    </div>
                  </div>
                )}
              </button>

              {/* Anteckningar / Husmanual */}
              <button
                type="button"
                className={`floating-dock__btn ${activePopover === 'notes' ? 'floating-dock__btn--active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'notes' ? null : 'notes')}
                title={t('notes_dock_title')}
              >
                <FileText size={20} style={{ strokeWidth: 2.2 }} />
                {activePopover === 'notes' && (
                  <div className="dock-popover notes-popover" onClick={(e) => e.stopPropagation()}>
                    <div className="section-header">
                      <span className="section-header__title">{t('notes_header_title')}</span>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                      {config.info.notes?.length > 0 ? (
                        config.info.notes.map((note, i) => (
                          <div key={i} className="note-item">
                            <div className="note-item__icon-wrap">{note.emoji || '📝'}</div>
                            <div>
                              <div className="note-item__title">{note.title}</div>
                              <div className="note-item__text">{note.text}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-dim" style={{ textAlign: 'center', padding: '10px 0' }}>{t('no_notes_yet')}</p>
                      )}
                    </div>
                  </div>
                )}
              </button>

                {/* Systemstatus / Notifikationer */}
                <button
                  type="button"
                  className={`floating-dock__btn ${activePopover === 'status' ? 'floating-dock__btn--active' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                  title={t('status_dock_title')}
                >
                  <Info size={20} style={{ strokeWidth: 2.2 }} />
                  {activePopover === 'status' && (
                    <div className="dock-popover status-popover" onClick={(e) => e.stopPropagation()}>
                      <div className="section-header">
                        <span className="section-header__title">{t('status_dock_title')}</span>
                      </div>
                      <div className="status-list">
                        <div className="status-item">
                          <span className="status-item__label">{t('status_conn_label')}</span>
                          <span className="status-item__value" style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
                            {connected ? t('status_online') : t('status_offline')}
                          </span>
                        </div>
                        <div className="status-item">
                          <span className="status-item__label">{t('status_lights_label')}</span>
                          <span className="status-item__value">
                            {t('status_devices_count', { count: config.lights?.length ?? 0 })}
                          </span>
                        </div>
                        <div className="status-item">
                          <span className="status-item__label">{t('status_media_label')}</span>
                          <span className="status-item__value">
                            {t('status_active_count', { count: config.media_players?.length ?? 0 })}
                          </span>
                        </div>
                        <div className="status-item">
                          <span className="status-item__label">{t('status_gateway_ip')}</span>
                          <span className="status-item__value" style={{ fontFamily: 'monospace' }}>
                            {config.ikea?.ip || config.hue?.ip || 'Lokalt API'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
                

            </div>
          </div>
        )}

        {/* ── Room Organizer Modal ── */}
        {showOrganizer && config && (
          <RoomOrganizer
            config={config}
            onSave={handleSaveRooms}
            onClose={() => setShowOrganizer(false)}
            t={t}
          />
        )}

        {/* ── Setup Wizard Modal (Edit Mode) ── */}
        {showSetupWizard && config && (
          <div className="setup-wizard-overlay">
            <SetupWizard
              initialConfig={config}
              onComplete={() => {
                setShowSetupWizard(false)
                const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
                setLocale(saved === 'en' ? 'en' : 'sv')
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

