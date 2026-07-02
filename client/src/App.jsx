import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, Wifi, FileText, Info, Lightbulb, LightbulbOff, Copy, Check, Loader2, KeyRound, X, Gamepad, Sofa, Utensils, Bed, DoorOpen, Archive, Home, Bath, Flower2, Tv, Laptop } from 'lucide-react'
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
const socket = io({ 
  path: `${import.meta.env.BASE_URL || '/'}socket.io`.replace(/\/+/g, '/'), 
  transports: ['websocket', 'polling'] 
})

// Gruppera lampor per rum
function groupByRoom(lights, defaultRoomName = 'Other') {
  return lights.reduce((acc, light) => {
    const room = light.room || defaultRoomName
    if (!acc[room]) acc[room] = []
    acc[room].push(light)
    return acc
  }, {})
}

const ICON_MAP = {
  Sofa,
  Gamepad,
  Utensils,
  Bed,
  DoorOpen,
  Bath,
  Flower2,
  Tv,
  Laptop,
  Archive,
  Home
}

// Map room names to Lucide icons (supporting custom room objects or name-based heuristics)
function getRoomIcon(roomName, config) {
  const name = (roomName || '').toLowerCase().trim();
  const iconStyle = { marginRight: '8px', flexShrink: 0, opacity: 0.85 };
  
  // 1. Look for custom icon configured in config.rooms
  if (config && Array.isArray(config.rooms)) {
    const matchedRoom = config.rooms.find(r => {
      if (typeof r === 'string') return r.toLowerCase().trim() === name;
      return r && typeof r === 'object' && r.name && r.name.toLowerCase().trim() === name;
    });
    if (matchedRoom && typeof matchedRoom === 'object' && matchedRoom.icon) {
      const IconComp = ICON_MAP[matchedRoom.icon];
      if (IconComp) {
        return <IconComp size={18} style={iconStyle} />;
      }
    }
  }

  // 2. Fallback to name-based heuristics
  if (name.includes('spel') || name.includes('game')) {
    return <Gamepad size={18} style={iconStyle} />;
  }
  if (name.includes('vardag') || name.includes('living') || name.includes('soffa')) {
    return <Sofa size={18} style={iconStyle} />;
  }
  if (name.includes('kök') || name.includes('kitchen') || name.includes('mat')) {
    return <Utensils size={18} style={iconStyle} />;
  }
  if (name.includes('sov') || name.includes('bed') || name.includes('john')) {
    return <Bed size={18} style={iconStyle} />;
  }
  if (name.includes('aula') || name.includes('hall') || name.includes('entré')) {
    return <DoorOpen size={18} style={iconStyle} />;
  }
  if (name.includes('bad') || name.includes('bath') || name.includes('toa')) {
    return <Bath size={18} style={iconStyle} />;
  }
  if (name.includes('ute') || name.includes('garden') || name.includes('balkong') || name.includes('blomma')) {
    return <Flower2 size={18} style={iconStyle} />;
  }
  if (name.includes('tv') || name.includes('media')) {
    return <Tv size={18} style={iconStyle} />;
  }
  if (name.includes('kontor') || name.includes('work') || name.includes('laptop')) {
    return <Laptop size={18} style={iconStyle} />;
  }
  if (name.includes('övrigt') || name.includes('other') || name.includes('misc')) {
    return <Archive size={18} style={iconStyle} />;
  }
  return <Home size={18} style={iconStyle} />;
}

// Global fetch interceptor to inject X-Admin-Password header for setup APIs and handle subdirectory paths
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  // Prepend BASE_URL for all relative/absolute API paths
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : base + '/';
    url = cleanBase + url.substring(1);
  }

  const pwd = sessionStorage.getItem('admin_password');
  if (pwd && url.toString().includes('/api/setup')) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      options.headers.set('X-Admin-Password', pwd);
    } else {
      options.headers['X-Admin-Password'] = pwd;
    }
  }
  const response = await originalFetch(url, options);
  if (response.status === 401 && url.toString().includes('/api/setup')) {
    sessionStorage.removeItem('admin_password');
  }
  return response;
};

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
  const [fullConfig, setFullConfig] = useState(null)
  const [setupStep, setSetupStep] = useState(undefined)
  const [isDefaultPassword, setIsDefaultPassword] = useState(true)

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState(null)
  const [pendingCallback, setPendingCallback] = useState(null)

  const checkAdminAccess = useCallback((callback) => {
    // Om setup inte är klar behövs inget lösenord
    if (setupNeeded) {
      callback()
      return
    }

    const savedPwd = sessionStorage.getItem('admin_password')
    if (savedPwd) {
      callback()
      return
    }

    setPendingCallback(() => callback)
    setLoginPassword('')
    setLoginError(null)
    setShowLoginModal(true)
  }, [setupNeeded])

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setLoginError(null)
    try {
      const res = await fetch('/api/setup/config', {
        headers: {
          'X-Admin-Password': loginPassword
        }
      })
      if (!res.ok) {
        throw new Error(t('login_modal_error'))
      }
      const fullConfigData = await res.json()
      sessionStorage.setItem('admin_password', loginPassword)
      setFullConfig(fullConfigData)
      setShowLoginModal(false)
      if (pendingCallback) {
        pendingCallback()
        setPendingCallback(null)
      }
    } catch (err) {
      setLoginError(err.message)
    }
  }
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
      const res = await fetch('/api/setup/save-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lights: updatedLights,
          rooms: updatedRooms
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
        setIsDefaultPassword(data.isDefaultPassword !== false)
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
          setIsDefaultPassword(data.isDefaultPassword !== false)
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
            onOpenSetupWizard={(step) => checkAdminAccess(async () => {
              try {
                const res = await fetch('/api/setup/config')
                if (res.ok) {
                  const data = await res.json()
                  setFullConfig(data)
                  setSetupStep(step)
                  setShowSetupWizard(true)
                } else {
                  alert(t('fetch_config_error') || 'Kunde inte hämta administratörskonfiguration.')
                }
              } catch (err) {
                console.error(err)
                alert(err?.message || 'Kunde inte hämta administratörskonfiguration.')
              }
            })}
            blurEnabled={blurEnabled}
            onToggleBlur={toggleBlur}
            locale={locale}
            t={t}
            isAdminLoggedIn={!!sessionStorage.getItem('admin_password')}
            onLogInOut={() => {
              if (sessionStorage.getItem('admin_password')) {
                sessionStorage.removeItem('admin_password')
                window.location.reload()
              } else {
                checkAdminAccess(() => {
                  window.location.reload()
                })
              }
            }}
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
                      const idxA = savedRooms.findIndex(r => {
                        if (typeof r === 'string') return r === roomA;
                        return r && r.name === roomA;
                      })
                      const idxB = savedRooms.findIndex(r => {
                        if (typeof r === 'string') return r === roomB;
                        return r && r.name === roomB;
                      })
                      if (idxA === -1 && idxB === -1) return roomA.localeCompare(roomB)
                      if (idxA === -1) return 1
                      if (idxB === -1) return -1
                      return idxA - idxB
                    })
                    .map(([room, lights]) => (
                      <div key={room} className="room-section" style={{ marginBottom: 'var(--space-4)' }}>
                        <p className="text-xs font-semibold"
                           style={{ 
                             textTransform: 'uppercase', 
                             letterSpacing: '0.06em', 
                             marginBottom: 12, 
                             display: 'flex', 
                             alignItems: 'center',
                             gap: '6px'
                           }}>
                          {getRoomIcon(room, config)}
                          <span>{room}</span>
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
            </section>
          </div>
        )}

        {/* ── Flytande Bottenmeny (Dock-bar) ── */}
        {config && (
          <div className="floating-dock-container" ref={dockRef}>
            <div className={`floating-dock ${config.media_players.length > 0 ? 'floating-dock--has-media' : ''}`}>
              {/* Media widget on the left side of the dock */}
              {config.media_players.length > 0 && (
                <div className="floating-dock__media" style={{ display: 'flex', alignItems: 'center', width: '360px', flexShrink: 0, paddingRight: '20px', borderRight: '1px solid rgba(0, 0, 0, 0.08)' }}>
                  <MediaCard
                    config={config.media_players[0]}
                    state={states[config.media_players[0].entity_id]}
                    onControl={controlMedia}
                    t={t}
                    layout="inline"
                  />
                </div>
              )}

              {/* Action Buttons Capsule */}
              <div className="floating-dock__actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '100px', background: 'rgba(0, 0, 0, 0.035)', border: '1px solid rgba(0, 0, 0, 0.02)' }}>
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
        {showSetupWizard && fullConfig && (
          <div className="setup-wizard-overlay">
            <SetupWizard
              initialConfig={fullConfig}
              initialStep={setupStep}
              onComplete={() => {
                setShowSetupWizard(false)
                setFullConfig(null)
                setSetupStep(undefined)
                const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
                setLocale(saved === 'en' ? 'en' : 'sv')
                socket.emit('setup_complete')
              }}
              onCancel={() => {
                setShowSetupWizard(false)
                setFullConfig(null)
                setSetupStep(undefined)
              }}
            />
          </div>
        )}

        {/* ── Admin Login Modal Overlay ── */}
        {showLoginModal && (
          <div className="login-modal-overlay fade-in" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(10, 10, 12, 0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div className="login-modal-card" style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              padding: '32px 28px',
              borderRadius: '24px',
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              alignItems: 'stretch'
            }}>
              {/* Close Button */}
              <button 
                type="button"
                onClick={() => {
                  setShowLoginModal(false)
                  setPendingCallback(null)
                }}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'none',
                  border: 'none',
                  color: '#e4e4e7',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = '#e4e4e7'
                }}
              >
                <X size={18} />
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)'
                }}>
                  <KeyRound size={24} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', margin: '8px 0 2px 0', color: '#ffffff' }}>
                  {t('login_modal_title')}
                </h2>
                {isDefaultPassword && (
                  <p style={{ fontSize: '0.875rem', color: '#93c5fd', fontWeight: 500, margin: 0 }}>
                    {t('login_modal_helper')}
                  </p>
                )}
              </div>

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="password"
                    autoFocus
                    placeholder={t('admin_password_placeholder') || 'Ange lösenord'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #3f3f46',
                      background: '#27272a',
                      color: '#ffffff',
                      fontSize: '0.9375rem',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6'
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#3f3f46'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {loginError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '0.8125rem',
                    fontWeight: 500
                  }}>
                    <span>⚠️ {loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="setup-btn setup-btn--primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {t('login_modal_submit')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

