import { useState, useEffect, useRef } from 'react'
import { FolderOpen, Plus, Trash2, ArrowLeft, Settings, Check, HelpCircle, Home, Lightbulb, Sliders, Palette, Cast, Cpu, Wifi, Save, Power, RefreshCw, Search, Zap, Server, CheckCircle2, AlertCircle, Pin, AlertTriangle, Loader2, Download, Upload, Globe, Network } from 'lucide-react'
import sv from '../languages/sv.js'
import en from '../languages/en.js'

const locales = { sv, en }

function LightConfigurator({ lights, onChange, rooms = [], onAddRoom, t }) {
  const [newRoomForLight, setNewRoomForLight] = useState({});
  const [showInlineNewRoom, setShowInlineNewRoom] = useState({});

  if (lights.length === 0) {
    return (
      <div className="setup-info-box" style={{ textAlign: 'center', borderStyle: 'solid' }}>
        <p className="text-sm text-dim">{t('hue_no_lights')}</p>
      </div>
    )
  }

  return (
    <div className="dynamic-lights-list">
      {lights.map((light, index) => {
        const isCreatingRoom = showInlineNewRoom[index];
        return (
          <div key={light.id} className={`dynamic-light-card ${light.enabled ? 'active' : ''}`}>
            <div className="light-row-main">
              <label className="light-label-clickable">
                <input
                  type="checkbox"
                  checked={light.enabled}
                  onChange={(e) => onChange(index, 'enabled', e.target.checked)}
                  className="light-checkbox"
                />
                <span className="light-emoji">
                  <Lightbulb size={18} style={{ color: light.supports_color_temp ? '#fbbf24' : '#f472b6' }} />
                </span>
                <div className="light-names">
                  <span className="light-discovered-name">{light.discoveredName}</span>
                  <span className="light-capabilities">
                    {light.supports_brightness ? t('brightness') : ''}
                    {light.supports_color_temp ? t('color_temp') : ''}
                  </span>
                </div>
              </label>
            </div>
            
            {light.enabled && (
              <div className="light-row-edit fade-in">
                <div className="form-group">
                  <label>{t('hue_light_name_label')}</label>
                  <input
                    type="text"
                    value={light.name}
                    onChange={(e) => onChange(index, 'name', e.target.value)}
                    placeholder={t('hue_light_name_placeholder')}
                  />
                </div>
                <div className="room-select-container">
                  <label>{t('hue_light_room_label')}</label>
                  {!isCreatingRoom ? (
                    <select
                      className="room-select-dropdown"
                      value={light.room || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__new__') {
                          setShowInlineNewRoom({ ...showInlineNewRoom, [index]: true });
                        } else {
                          onChange(index, 'room', val);
                        }
                      }}
                    >
                      <option value="" disabled>{t('hue_room_select_placeholder')}</option>
                      {rooms.map((room) => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                      <option value="__new__">{t('hue_create_room_option')}</option>
                    </select>
                  ) : (
                    <div className="room-new-inline">
                      <input
                        type="text"
                        placeholder={t('hue_new_room_placeholder')}
                        value={newRoomForLight[index] || ''}
                        onChange={(e) => setNewRoomForLight({ ...newRoomForLight, [index]: e.target.value })}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="setup-btn setup-btn--primary"
                        onClick={() => {
                          const name = (newRoomForLight[index] || '').trim();
                          if (name) {
                            const formatted = name.charAt(0).toUpperCase() + name.slice(1);
                            onAddRoom(formatted);
                            onChange(index, 'room', formatted);
                          }
                          setShowInlineNewRoom({ ...showInlineNewRoom, [index]: false });
                          setNewRoomForLight({ ...newRoomForLight, [index]: '' });
                        }}
                      >
                        {t('hue_new_room_ok')}
                      </button>
                      <button
                        type="button"
                        className="setup-btn setup-btn--secondary"
                        onClick={() => {
                          setShowInlineNewRoom({ ...showInlineNewRoom, [index]: false });
                          setNewRoomForLight({ ...newRoomForLight, [index]: '' });
                        }}
                      >
                        {t('hue_new_room_cancel')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  )
}

export default function SetupWizard({ onComplete, initialConfig, onCancel }) {
  const [locale, setLocale] = useState(() => {
    const saved = localStorage.getItem('setup_wizard_locale')
    return saved === 'en' ? 'en' : 'sv'
  })

  const t = (key, replaces = {}) => {
    let str = locales[locale]?.[key] || locales['sv']?.[key] || key
    Object.entries(replaces).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
    return str
  }

  const changeLocale = (newLocale) => {
    setLocale(newLocale)
    localStorage.setItem('setup_wizard_locale', newLocale)
  }

  const [step, setStep] = useState(() => {
    if (initialConfig) {
      const isLargeScreen = typeof window !== 'undefined' && window.innerWidth >= 768
      return isLargeScreen ? 12 : 100
    }
    return 1
  })
  const [rooms, setRooms] = useState(() => {
    if (initialConfig?.rooms && initialConfig.rooms.length > 0) {
      return initialConfig.rooms
    }
    const existing = (initialConfig?.lights ?? []).map((l) => l.room).filter(Boolean)
    const unique = Array.from(new Set(existing))
    if (unique.length > 0) return unique
    const savedLocale = localStorage.getItem('setup_wizard_locale')
    return savedLocale === 'en'
      ? ['Living room', 'Kitchen', 'Bedroom', 'Hall']
      : ['Vardagsrum', 'Kök', 'Sovrum', 'Hall']
  })

  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleAddRoomName = (roomName) => {
    const trimmed = roomName.trim()
    if (!trimmed) return
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    if (!rooms.includes(formatted)) {
      setRooms([...rooms, formatted])
      markDirty()
    }
  }
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const markDirty = () => {
    if (initialConfig) setHasUnsavedChanges(true)
  }

  const handleImportBackup = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target.result)
        if (!config || typeof config !== 'object' || !config.lights) {
          alert(t('backup_invalid'))
          return
        }

        if (!confirm(t('backup_confirm'))) {
          return
        }

        setLoading(true)
        const res = await fetch('/api/setup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || t('save_failed_msg'))
        }

        alert(t('backup_success'))
        if (onComplete) onComplete()
      } catch (err) {
        console.error('Import misslyckades:', err)
        alert(`Kunde inte importera konfigurationen: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(file)
  }

  const handleExportBackup = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/setup/config')
      if (!res.ok) throw new Error(t('fetch_config_error'))
      const data = await res.json()
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute("download", `gastportal-backup-${new Date().toISOString().split('T')[0]}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    } catch (err) {
      console.error(err)
      setError(err.message || t('save_failed_msg'))
    } finally {
      setLoading(false)
    }
  }

  const handleFactoryReset = async () => {
    if (resetConfirmText !== 'BEKRÄFTA') return
    try {
      setResetting(true)
      setError(null)
      const res = await fetch('/api/setup/factory-reset', { method: 'POST' })
      if (!res.ok) {
        throw new Error(t('factory_reset_server_error'))
      }
      window.location.reload()
    } catch (err) {
      console.error(err)
      setError(err.message || t('factory_reset_error'))
      setResetting(false)
    }
  }

  // ── States för varje steg ───────────────────────────────
  const [services, setServices] = useState({
    hue: true,
    ikea: true,
    govee: true,
    cast: true,
    matter: true
  })

  const [hue, setHue] = useState({ ip: '', apiKey: '', paired: false })
  const [hueLights, setHueLights] = useState([])

  const [ikea, setIkea] = useState({
    type: 'dirigera', // 'dirigera' | 'tradfri'
    ip: '',
    code: '',         // Dirigera 9-siffrig kod
    securityCode: '', // Trådfri Gateway kod under
    token: '',
    identity: '',
    psk: '',
    paired: false
  })
  const [ikeaLights, setIkeaLights] = useState([])

  const [govee, setGovee] = useState({ apiKey: '', paired: false })
  const [goveeLights, setGoveeLights] = useState([])

  const [matterCode, setMatterCode] = useState('')
  const [matterScan, setMatterScan] = useState({ loading: false, error: null, devices: [] })
  const [matterLights, setMatterLights] = useState([])
  const [matterPaired, setMatterPaired] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)

  const [castList, setCastList] = useState([
    { ip: '', name: 'Google Streamer', tested: false, error: null, loading: false }
  ])

  const [wifi, setWifi] = useState({
    name: 'GästPortal_WiFi',
    password: 'KännDigSomHemma'
  })

  const [notes, setNotes] = useState(() => {
    const savedLocale = localStorage.getItem('setup_wizard_locale')
    return savedLocale === 'en'
      ? [
          { emoji: '☕', title: 'Coffee Machine', text: 'Located in the kitchen. Pods are in the cabinet next to it.' },
          { emoji: '🧻', title: 'Towels', text: 'Fresh towels are on the shelf in the bathroom.' },
          { emoji: '🔑', title: 'Front Door', text: 'Locks automatically after 10 seconds.' }
        ]
      : [
          { emoji: '☕', title: 'Kaffemaskinen', text: 'Finns i köket. Kapslar finns i skåpet bredvid.' },
          { emoji: '🧻', title: 'Handdukar', text: 'Färska handdukar finns på hyllan i badrummet.' },
          { emoji: '🔑', title: 'Ytterdörr', text: 'Låser sig automatiskt efter 10 sekunder.' }
        ]
  })

  const hasInitializedRef = useRef(false)

  // ── Prefill från befintlig konfiguration (Edit Mode) ──
  useEffect(() => {
    if (hasInitializedRef.current) return
    if (!initialConfig) return
    hasInitializedRef.current = true

    setServices({
      hue: !!(initialConfig.hue?.ip && initialConfig.hue?.apiKey),
      ikea: !!(initialConfig.ikea?.ip && (initialConfig.ikea?.token || initialConfig.ikea?.psk)),
      govee: !!initialConfig.govee?.apiKey,
      cast: !!(initialConfig.cast && initialConfig.cast.length > 0),
      matter: !!(initialConfig.matter && initialConfig.matter.length > 0)
    })

    if (initialConfig.matter) {
      const existingMatterLights = (initialConfig.lights ?? []).filter(l => l.bridge === 'matter')
      if (existingMatterLights.length > 0) {
        setMatterLights(existingMatterLights.map(l => ({
          id: l.bridge_id || l.entity_id,
          nodeId: l.entity_id.split('_')[1],
          endpointId: parseInt(l.entity_id.split('_')[2] || '1', 10),
          name: l.name,
          room: l.room || 'Vardagsrum',
          supports_brightness: l.supports_brightness,
          supports_color_temp: l.supports_color_temp,
          isOutlet: l.isOutlet || false,
          enabled: true
        })))
        setMatterPaired(true)
      }
    }

    if (initialConfig.hue) {
      setHue({
        ip: initialConfig.hue.ip || '',
        apiKey: initialConfig.hue.apiKey || '',
        paired: !!initialConfig.hue.apiKey
      })
      if (initialConfig.hue.ip && initialConfig.hue.apiKey) {
        fetchHueLights(initialConfig.hue.ip, initialConfig.hue.apiKey)
      }
    }

    if (initialConfig.ikea) {
      setIkea({
        type: initialConfig.ikea.bridge || 'dirigera',
        ip: initialConfig.ikea.ip || '',
        code: '',
        securityCode: '',
        token: initialConfig.ikea.token || '',
        identity: initialConfig.ikea.identity || '',
        psk: initialConfig.ikea.psk || '',
        paired: !!(initialConfig.ikea.token || initialConfig.ikea.psk)
      })
      if (initialConfig.ikea.ip && (initialConfig.ikea.token || initialConfig.ikea.psk)) {
        fetchIkeaLights(
          initialConfig.ikea.bridge || 'dirigera',
          initialConfig.ikea.ip,
          initialConfig.ikea.token,
          initialConfig.ikea.identity,
          initialConfig.ikea.psk
        )
      }
    }

    if (initialConfig.govee) {
      setGovee({
        apiKey: initialConfig.govee.apiKey || '',
        paired: !!initialConfig.govee.apiKey
      })
      if (initialConfig.govee.apiKey) {
        fetchGoveeLights(initialConfig.govee.apiKey)
      }
    }

    if (initialConfig.cast && initialConfig.cast.length > 0) {
      setCastList(
        initialConfig.cast.map((c) => ({
          ip: c.ip,
          name: c.name,
          tested: true,
          error: null,
          loading: false
        }))
      )
    }

    if (initialConfig.info) {
      setWifi({
        name: initialConfig.info.wifi_name || initialConfig.info.wifiName || '',
        password: initialConfig.info.wifi_password || initialConfig.info.wifiPassword || ''
      })
      if (initialConfig.info.notes && initialConfig.info.notes.length > 0) {
        setNotes(initialConfig.info.notes)
      }
    }
  }, [initialConfig])

  // Automatic fetching of Matter lights when entering the Matter step
  useEffect(() => {
    if (step === 10 && services.matter) {
      fetchMatterLights()
    }
  }, [step, services.matter])

  // ── Hue Discovery ───────────────────────────────────────
  const discoverHue = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/hue/discover', { method: 'POST' })
      const data = await res.json()
      if (data.found) {
        setHue((prev) => ({ ...prev, ip: data.ip }))
      } else {
        setError(t('hue_ip_error'))
      }
    } catch {
      setError(t('hue_search_failed'))
    } finally {
      setLoading(false)
    }
  }

  // ── Hue Pairing ─────────────────────────────────────────
  const pairHue = async () => {
    if (!hue.ip) return setError(t('hue_ip_empty'))
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/hue/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: hue.ip })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('hue_pair_failed'))

      setHue((prev) => ({
        ...prev,
        apiKey: data.apiKey,
        paired: true
      }))

      // Hämta och läs in alla Hue-lampor
      fetchHueLights(hue.ip, data.apiKey)
    } catch (err) {
      setError(err.message === 'link button not pressed'
        ? t('hue_press_button')
        : `${t('hue_pair_failed')}: ${err.message}`
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchHueLights = async (ip, key) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/hue/lights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, apiKey: key })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('hue_fetch_error'))
      if (data.lights) {
        setHueLights(data.lights.map((l) => {
          const saved = initialConfig?.lights?.find((sl) => sl.bridge_id === l.id && sl.bridge === 'hue')
          return {
            id: l.id,
            discoveredName: l.name,
            name: saved ? saved.name : l.name,
            room: saved ? saved.room : 'Vardagsrum',
            enabled: saved ? true : false,
            supports_brightness: l.supports_brightness,
            supports_color_temp: l.supports_color_temp
          }
        }))
      }
    } catch (err) {
      console.error('Kunde inte läsa lampor:', err)
      setError(t('hue_read_error', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  // ── Matter Helpers ─────────────────────────────────────
  const discoverMatterDevices = async () => {
    setMatterScan((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch('/api/setup/matter/discover', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Discovery misslyckades')
      
      setMatterScan({
        loading: false,
        error: null,
        devices: data.found || []
      })
    } catch (err) {
      setMatterScan({
        loading: false,
        error: err.message,
        devices: []
      })
    }
  }

  const pairMatterDevice = async () => {
    if (!matterCode) return setError('Fyll i parningskod')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/matter/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: matterCode,
          ...(selectedDevice && { 
            discriminator: selectedDevice.discriminator,
            instanceName: selectedDevice.instanceName
          })
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pairing misslyckades')

      setMatterPaired(true)
      setSelectedDevice(null) // Reset selection on success
      // Hämta nyligen parade enheters lampor
      fetchMatterLights()
    } catch (err) {
      setError(t('matter_pair_failed', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  const fetchMatterLights = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/matter/lights', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('matter_fetch_error'))
      if (data.lights) {
        setMatterLights((prev) => {
          return data.lights.map((l) => {
            const current = prev.find((x) => x.id === l.id)
            if (current) return current

            const saved = initialConfig?.lights?.find((sl) => sl.bridge_id === l.id && sl.bridge === 'matter')
            return {
              id: l.id,
              nodeId: l.nodeId,
              endpointId: l.endpointId,
              discoveredName: l.name,
              name: saved ? saved.name : l.name,
              room: saved ? saved.room : 'Vardagsrum',
              enabled: saved ? true : true,
              supports_brightness: l.supports_brightness,
              supports_color_temp: l.supports_color_temp,
              isOutlet: l.isOutlet || false
            }
          })
        })
      }
    } catch (err) {
      console.error('Kunde inte läsa Matter-lampor:', err)
      setError(t('matter_read_error', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  // ── IKEA Hub / Gateway pairing ─────────────────────────
  const pairIkea = async () => {
    if (!ikea.ip) return setError(t('ikea_ip_error'))
    
    setLoading(true)
    setError(null)
    try {
      if (ikea.type === 'dirigera') {
        if (!ikea.code) return setError(t('ikea_code_error'))
        const res = await fetch('/api/setup/ikea/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: ikea.ip, code: ikea.code })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t('ikea_pair_failed'))

        setIkea((prev) => ({
          ...prev,
          token: data.token,
          paired: true
        }))
        fetchIkeaLights('dirigera', ikea.ip, data.token)
      } else {
        // Trådfri Gateway (äldre)
        if (!ikea.securityCode) return setError(t('ikea_sec_code_error'))
        const res = await fetch('/api/setup/ikea_tradfri/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: ikea.ip, securityCode: ikea.securityCode })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t('ikea_pair_failed'))

        setIkea((prev) => ({
          ...prev,
          identity: data.identity,
          psk: data.psk,
          paired: true
        }))
        fetchIkeaLights('ikea_tradfri', ikea.ip, null, data.identity, data.psk)
      }
    } catch (err) {
      setError(t('ikea_pair_failed_msg', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  const fetchIkeaLights = async (type, ip, token, identity = null, psk = null) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/ikea/lights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge: type, ip, token, identity, psk })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('ikea_fetch_error'))
      if (data.lights) {
        setIkeaLights(data.lights.map((l) => {
          const saved = initialConfig?.lights?.find((sl) => sl.bridge_id === l.id && sl.bridge === 'ikea')
          return {
            id: l.id,
            discoveredName: l.name,
            name: saved ? saved.name : l.name,
            room: saved ? saved.room : 'Hall',
            enabled: saved ? true : false,
            supports_brightness: l.supports_brightness,
            supports_color_temp: l.supports_color_temp,
            isOutlet: l.isOutlet || false
          }
        }))
      }
    } catch (err) {
      console.error('Kunde inte läsa IKEA lampor:', err)
      setError(t('ikea_read_error', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  // ── Govee API test ──────────────────────────────────────
  const testGovee = async () => {
    if (!govee.apiKey) return setError(t('govee_api_key_empty'))
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/govee/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: govee.apiKey })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('govee_invalid_key'))

      setGovee((prev) => ({
        ...prev,
        paired: true
      }))
      fetchGoveeLights(govee.apiKey)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchGoveeLights = async (key) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/govee/lights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('govee_fetch_error'))
      if (data.lights) {
        setGoveeLights(data.lights.map((l) => {
          const saved = initialConfig?.lights?.find((sl) => sl.bridge_id === l.id && sl.bridge === 'govee')
          return {
            id: l.id,
            discoveredName: l.name,
            name: saved ? saved.name : l.name,
            room: saved ? saved.room : 'Vardagsrum',
            enabled: saved ? true : false,
            supports_brightness: l.supports_brightness,
            supports_color_temp: l.supports_color_temp,
            model: l.model,
            apiVersion: l.apiVersion || 'legacy'
          }
        }))
      }
    } catch (err) {
      console.error('Kunde inte läsa Govee lampor:', err)
      setError(t('govee_read_error', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }



  // ── Cast Device test ────────────────────────────────────
  const testCastDevice = async (index) => {
    const cast = castList[index]
    if (!cast.ip) return

    setCastList((prev) => {
      const copy = [...prev]
      copy[index].loading = true
      copy[index].error = null
      return copy
    })

    try {
      const res = await fetch('/api/setup/cast/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: cast.ip, name: cast.name })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test misslyckades')

      setCastList((prev) => {
        const copy = [...prev]
        copy[index].loading = false
        copy[index].tested = true
        return copy
      })
    } catch (err) {
      setCastList((prev) => {
        const copy = [...prev]
        copy[index].loading = false
        copy[index].tested = false
        copy[index].error = err.message
        return copy
      })
    }
  }

  const testAllCastDevices = async () => {
    setLoading(true)
    setError(null)
    try {
      const promises = castList.map((c, idx) => {
        if (c.ip) return testCastDevice(idx)
        return Promise.resolve()
      })
      await Promise.all(promises)
    } catch (err) {
      setError(`Kunde inte testa alla Cast-enheter: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCastChange = (index, field, value) => {
    setCastList((prev) => {
      const copy = [...prev]
      copy[index][field] = value
      copy[index].tested = false
      copy[index].error = null
      return copy
    })
    markDirty()
  }

  const addCastDevice = () => {
    setCastList((prev) => [...prev, { ip: '', name: `Cast Enhet ${prev.length + 1}`, tested: false, error: null, loading: false }])
    markDirty()
  }

  const removeCastDevice = (index) => {
    setCastList((prev) => prev.filter((_, i) => i !== index))
    markDirty()
  }

  // ── Helper för förändringar i lampor ─────────────────────
  const updateHueLight = (index, field, val) => {
    setHueLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
    markDirty()
  }

  const updateIkeaLight = (index, field, val) => {
    setIkeaLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
    markDirty()
  }

  const updateGoveeLight = (index, field, val) => {
    setGoveeLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
    markDirty()
  }

  const updateMatterLight = (index, field, val) => {
    setMatterLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
    markDirty()
  }

  // ── Notes manipulation ───────────────────────────────────
  const handleNoteChange = (index, field, value) => {
    setNotes((prev) => {
      const copy = [...prev]
      copy[index][field] = value
      return copy
    })
    markDirty()
  }

  const addNote = () => {
    setNotes((prev) => [...prev, { emoji: '📌', title: t('new_note_title'), text: t('new_note_desc') }])
    markDirty()
  }

  const removeNote = (index) => {
    setNotes((prev) => prev.filter((_, i) => i !== index))
    markDirty()
  }

  // ── Save configuration ──────────────────────────────────
  const saveSetup = async ({ closeAfter = true } = {}) => {
    setLoading(true)
    setError(null)

    try {
      // 1. Skapa final list med valda lampor
      const finalLights = []

      hueLights.filter((l) => l.enabled).forEach((l) => {
        finalLights.push({
          entity_id: `hue_${l.id.replace(/[-:]/g, '_')}`,
          bridge: 'hue',
          bridge_id: l.id,
          name: l.name,
          room: l.room,
          supports_brightness: l.supports_brightness,
          supports_color_temp: l.supports_color_temp
        })
      })

      ikeaLights.filter((l) => l.enabled).forEach((l) => {
        finalLights.push({
          entity_id: `ikea_${l.id.replace(/[-:]/g, '_')}`,
          bridge: 'ikea',
          bridge_id: l.id,
          name: l.name,
          room: l.room,
          supports_brightness: l.supports_brightness,
          supports_color_temp: l.supports_color_temp,
          isOutlet: l.isOutlet || false
        })
      })

      goveeLights.filter((l) => l.enabled).forEach((l) => {
        finalLights.push({
          entity_id: `govee_${l.id.replace(/[-:]/g, '_')}`,
          bridge: 'govee',
          bridge_id: l.id,
          name: l.name,
          room: l.room,
          supports_brightness: l.supports_brightness,
          supports_color_temp: l.supports_color_temp,
          govee_model: l.model,
          govee_api_version: l.apiVersion || 'legacy'
        })
      })

      matterLights.filter((l) => l.enabled).forEach((l) => {
        finalLights.push({
          entity_id: `matter_${l.nodeId}_${l.endpointId}`,
          bridge: 'matter',
          bridge_id: l.id,
          name: l.name,
          room: l.room,
          supports_brightness: l.supports_brightness,
          supports_color_temp: l.supports_color_temp || false,
          isOutlet: l.isOutlet || false
        })
      })

      // 2. Autogenerera scener baserat på de aktiverade lamporna
      const scenes = [
        {
          id: 'mysigt',
          name: 'Mysigt',
          emoji: '🕯️',
          description: 'Varm, dämpad belysning',
          color: '#f59e0b',
          transition_ms: 2000,
          actions: finalLights.map((l) => ({
            entity_id: l.entity_id,
            state: 'on',
            ...(l.supports_brightness && { brightness: 90 }),
            ...(l.supports_color_temp && { color_temp: 420 })
          }))
        },
        {
          id: 'lasning',
          name: 'Läsning',
          emoji: '📖',
          description: 'Ljus, klar belysning',
          color: '#93c5fd',
          transition_ms: 1000,
          actions: finalLights.map((l) => ({
            entity_id: l.entity_id,
            state: 'on',
            ...(l.supports_brightness && { brightness: 200 }),
            ...(l.supports_color_temp && { color_temp: 300 })
          }))
        },
        {
          id: 'god_natt',
          name: 'God natt',
          emoji: '🌙',
          description: 'Släcker alla lampor',
          color: '#818cf8',
          transition_ms: 3000,
          actions: finalLights.map((l) => ({
            entity_id: l.entity_id,
            state: 'off'
          }))
        },
        {
          id: 'valkommen',
          name: 'Välkommen',
          emoji: '✨',
          description: 'Bjud in-belysning',
          color: '#34d399',
          transition_ms: 2000,
          actions: finalLights.map((l) => ({
            entity_id: l.entity_id,
            state: 'on',
            ...(l.supports_brightness && { brightness: 255 }),
            ...(l.supports_color_temp && { color_temp: 340 })
          }))
        }
      ]

      // 3. Cast-enheter
      const finalCast = castList.filter((c) => c.tested && c.ip).map((c) => ({
        ip: c.ip,
        name: c.name
      }))

      // 4. Info objektet
      const finalInfo = {
        wifi_name: wifi.name,
        wifi_password: wifi.password,
        notes: notes
      }

      const payload = {
        cast: finalCast,
        info: finalInfo,
        lights: finalLights,
        scenes: scenes,
        rooms: rooms,
        media_players: finalCast.map((c) => ({
          entity_id: `cast_${c.ip.replace(/\./g, '_')}`,
          bridge: 'cast',
          bridge_id: c.ip,
          name: c.name,
          icon: '📡'
        }))
      }

      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || t('save_failed_msg'))
      }

      setHasUnsavedChanges(false)
      if (closeAfter) {
        onComplete()
      }
    } catch (err) {
      setError(t('save_failed_error', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm(t('unsaved_changes_confirm'))) return
    }
    if (onCancel) onCancel()
  }

  // ── Navigering ──────────────────────────────────────────────
  const getActiveStepsList = () => {
    if (initialConfig) {
      return [12, 11, 2, 3, 4, 6, 10, 8, 14]
    }
    const list = [1] // Välkommen
    list.push(13) // Välj integrationer (Kort-grid)
    list.push(11) // Skapa rum
    if (services.hue) list.push(2)
    if (services.ikea) list.push(3)
    if (services.govee) list.push(4)
    if (services.cast) list.push(6)
    if (services.matter) list.push(10) // Matter Setup
    list.push(8) // WiFi & info
    list.push(14) // Code Graph
    list.push(9) // Spara & starta
    return list
  }

  const nextStep = () => {
    setError(null)
    const list = getActiveStepsList()
    const currentIndex = list.indexOf(step)
    if (currentIndex < list.length - 1) {
      setStep(list[currentIndex + 1])
    }
  }

  const prevStep = () => {
    setError(null)
    const list = getActiveStepsList()
    const currentIndex = list.indexOf(step)
    if (currentIndex > 0) {
      setStep(list[currentIndex - 1])
    }
  }

  // ── Rendering av steg ────────────────────────────────────
  const activeSteps = getActiveStepsList()
  const activeIndex = activeSteps.indexOf(step) + 1
  const totalActive = activeSteps.length
  const progressPct = (activeIndex / totalActive) * 100

  const editItems = [
    { id: 12, name: t('step_name_general'), iconComponent: Settings, colorClass: 'general', desc: t('general_settings_desc') },
    { id: 11, name: t('step_name_rooms'), iconComponent: Home, colorClass: 'rooms', desc: t('room_builder_desc') },
    { id: 2, name: t('step_name_hue'), iconComponent: Lightbulb, colorClass: 'hue', desc: t('hue_desc') },
    { id: 3, name: t('step_name_ikea'), iconComponent: Sliders, colorClass: 'ikea', desc: t('ikea_desc') },
    { id: 4, name: t('step_name_govee'), iconComponent: Palette, colorClass: 'govee', desc: t('govee_desc') },
    { id: 6, name: t('step_name_cast'), iconComponent: Cast, colorClass: 'cast', desc: t('cast_desc') },
    { id: 10, name: t('step_name_matter'), iconComponent: Cpu, colorClass: 'matter', desc: t('matter_desc') },
    { id: 8, name: t('step_name_wifi'), iconComponent: Wifi, colorClass: 'wifi', desc: t('wifi_desc') },
    { id: 14, name: t('graph_view_title'), iconComponent: Network, colorClass: 'graph', desc: t('graph_view_desc') },
  ]

  const getStepName = (stepId) => {
    switch (stepId) {
      case 1: return t('step_name_welcome')
      case 12: return t('step_name_general')
      case 11: return t('step_name_rooms')
      case 13: return t('step_name_integrations')
      case 2: return t('step_name_hue')
      case 3: return t('step_name_ikea')
      case 4: return t('step_name_govee')
      case 6: return t('step_name_cast')
      case 10: return t('step_name_matter')
      case 8: return t('step_name_wifi')
      case 14: return t('graph_view_title')
      case 9: return t('step_name_save')
      default: return `${t('step_prefix')} ${stepId}`
    }
  }
  const renderEditStepActions = () => (
    <div className="step-actions" style={{ marginTop: 24 }}>
      {hasUnsavedChanges ? (
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            className="setup-btn setup-btn--secondary"
            onClick={() => saveSetup({ closeAfter: false })}
            disabled={loading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {loading ? <Loader2 size={14} className="setup-btn-spin" /> : <Save size={14} />}
            {t('save_btn')}
          </button>
          <button
            className="setup-btn setup-btn--primary"
            onClick={() => saveSetup({ closeAfter: true })}
            disabled={loading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {loading ? <Loader2 size={14} className="setup-btn-spin" /> : <Save size={14} />}
            {t('save_and_close_btn')}
          </button>
        </div>
      ) : (
        <button
          className="setup-btn setup-btn--secondary"
          onClick={handleClose}
          style={{ width: '100%' }}
        >
          {t('close_btn')}
        </button>
      )}
    </div>
  )

  const renderDashboard = () => {
    return (
      <div className="setup-card fade-in" style={{ maxWidth: '100%' }}>
        <div className="setup-icon-wrapper setup-icon-wrapper--save">
          <Settings size={36} className="setup-icon-svg" />
        </div>
        <h2 style={{ textAlign: 'center' }}>{t('dashboard_title')}</h2>
        <p className="description" style={{ textAlign: 'center' }}>
          {t('dashboard_desc')}
        </p>

        <div className="settings-dashboard-grid">
          {editItems.map((item) => {
            const Icon = item.iconComponent;
            return (
              <button
                key={item.id}
                type="button"
                className="settings-dash-card"
                onClick={() => setStep(item.id)}
              >
                <span className={`settings-dash-card__icon settings-dash-card__icon--${item.colorClass}`}>
                  <Icon size={22} className="setup-icon-svg" />
                </span>
                <div className="settings-dash-card__content">
                  <span className="settings-dash-card__title">{item.name}</span>
                  <span className="settings-dash-card__desc">{item.desc}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const showSplitLayout = !isMobile && (initialConfig || step > 1) && step !== 100;
  const isWideContainer = !isMobile && (showSplitLayout || step === 100 || step === 10 || step === 1);
  const containerClass = `setup-container ${isWideContainer ? 'setup-container--wide' : ''}`;

  return (
    <div className={containerClass}>
      <div className="setup-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="setup-title">{initialConfig ? t('wizard_title_edit') : t('wizard_title_new')}</h1>
          {onCancel && (
            <button
              type="button"
              className="setup-btn setup-btn--cancel"
              onClick={handleClose}
            >
              ✕ {t('close_btn')}
            </button>
          )}
        </div>
        {!initialConfig ? (
          <>
            <p className="setup-subtitle">{t('step_prefix')} {activeIndex} {t('step_connector')} {totalActive}</p>
            <div className="setup-progress-bar">
              <div className="setup-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </>
        ) : (
          <p className="setup-subtitle" style={{ textAlign: 'left', marginTop: '4px' }}>
            {t('wizard_subtitle_edit')}
          </p>
        )}
      </div>

      <div className={showSplitLayout ? 'setup-split-layout' : ''}>
        {showSplitLayout && (
          initialConfig ? (
            /* Edit Mode Sidebar */
            <div className="settings-edit-sidebar">
              {editItems.map((item) => {
                const Icon = item.iconComponent;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-sidebar-item ${step === item.id ? 'settings-sidebar-item--active' : ''}`}
                    onClick={() => setStep(item.id)}
                  >
                    <Icon size={16} className={`sidebar-icon-svg sidebar-icon-svg--${item.colorClass}`} />
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Wizard Mode Stepper */
            <div className="setup-sidebar-stepper">
              {activeSteps.map((stepId, idx) => {
                const isActive = step === stepId;
                const isCompleted = activeSteps.indexOf(step) > idx;
                return (
                  <button
                    key={stepId}
                    type="button"
                    className={`stepper-item ${isActive ? 'stepper-item--active' : ''} ${isCompleted ? 'stepper-item--completed' : ''}`}
                    onClick={() => {
                      if (isCompleted || isActive) {
                        setStep(stepId);
                      }
                    }}
                    disabled={!isCompleted && !isActive}
                    style={{ cursor: (isCompleted || isActive) ? 'pointer' : 'not-allowed' }}
                  >
                    <div className="stepper-circle">
                      {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
                    </div>
                    <span>{getStepName(stepId)}</span>
                  </button>
                );
              })}
            </div>
          )
        )}

        <div className="setup-content-pane" style={{ width: '100%' }}>
          {error && (
            <div className="setup-alert setup-alert--error" role="alert" style={{ marginBottom: '20px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Show mobile back button in edit mode sub-step */}
          {initialConfig && step !== 100 && isMobile && (
            <button className="mobile-back-btn" onClick={() => setStep(100)} style={{ marginBottom: '16px' }}>
              {t('mobile_back_to_dashboard')}
            </button>
          )}

          {step === 100 && renderDashboard()}

          {/* STEG 12: Generella inställningar */}
          {step === 12 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--general">
                <Settings size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('general_settings_title')}</h2>
              <p className="description" style={{ marginBottom: 24 }}>
                {t('general_settings_desc')}
              </p>
                {/* Språkvyxlare */}
                <div className="lang-switcher-container" style={{ marginBottom: '24px' }}>
                  <div className="lang-selector-grid" style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className={`lang-pill-card ${locale === 'en' ? 'lang-pill-card--active' : ''}`}
                      onClick={() => changeLocale('en')}
                    >
                      <div className="lang-pill-card__icon">
                        <Globe size={20} />
                      </div>
                      <span className="lang-pill-card__name">{t('lang_en')}</span>
                    </button>
                    <button 
                      type="button" 
                      className={`lang-pill-card ${locale === 'sv' ? 'lang-pill-card--active' : ''}`}
                      onClick={() => changeLocale('sv')}
                    >
                      <div className="lang-pill-card__icon">
                        <Globe size={20} />
                      </div>
                      <span className="lang-pill-card__name">{t('lang_sv')}</span>
                    </button>
                  </div>
                </div>
                
                {/* Backup & Återställning */}
               <div className="backup-zone-card" style={{ marginBottom: '24px' }}>
                <h3 className="backup-zone-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--blue)', fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: '8px' }}>
                  <FolderOpen size={18} style={{ color: '#3b82f6' }} />
                  {t('backup_title')}
                </h3>
                <p className="backup-zone-desc" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginBottom: '16px', lineHeight: 1.4 }}>
                  {t('backup_desc')}
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="setup-btn setup-btn--secondary"
                    onClick={handleExportBackup}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={loading}
                  >
                    <Download size={14} />
                    {t('export_backup_btn')}
                  </button>
                  <label
                    className="setup-btn setup-btn--secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6, flex: 1, margin: 0 }}
                  >
                    <Upload size={14} />
                    {t('import_backup_btn')}
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      style={{ display: 'none' }}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>

              {/* Danger Zone för Fabriksåterställning */}
              <div className="danger-zone-card" style={{ marginTop: '32px', borderLeft: '4px solid #dc2626' }}>
                <h3 className="danger-zone-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: '8px' }}>
                  <AlertTriangle size={18} />
                  {t('danger_zone_title')}
                </h3>
                <p className="danger-zone-desc" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginBottom: '16px', lineHeight: 1.4 }}>
                  {t('danger_zone_desc')}
                </p>

                {!showResetConfirmation ? (
                  <button 
                    type="button" 
                    className="setup-btn setup-btn--danger"
                    onClick={() => {
                      setShowResetConfirmation(true)
                      setResetConfirmText('')
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Trash2 size={16} />
                    {t('factory_reset_btn')}
                  </button>
                ) : (
                  <div className="danger-confirm-box fade-in" style={{ background: 'rgba(220, 38, 38, 0.03)', border: '1px solid rgba(220, 38, 38, 0.15)', borderRadius: 'var(--radius-xs)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#dc2626', margin: 0 }}>
                      {t('factory_reset_confirm_text')}
                    </p>
                    <div className="input-group">
                      <input
                        type="text"
                        placeholder={t('confirm_input_placeholder')}
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                        disabled={resetting}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="setup-btn setup-btn--secondary"
                        onClick={() => setShowResetConfirmation(false)}
                        disabled={resetting}
                        style={{ flex: 1 }}
                      >
                        {t('cancel_btn')}
                      </button>
                      <button
                        type="button"
                        className="setup-btn setup-btn--danger-action"
                        onClick={handleFactoryReset}
                        disabled={resetConfirmText !== 'BEKRÄFTA' || resetting}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {resetting ? (
                          <>
                            <Loader2 size={14} className="setup-btn-spin" />
                            {t('factory_resetting_status')}
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            {t('factory_reset_action_btn')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="step-actions" style={{ marginTop: 24 }}>
                {initialConfig ? (
                  renderEditStepActions()
                ) : (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEG 1: Välkommen */}
          {step === 1 && (
            <div className="setup-card fade-in welcome-splash" style={{ maxWidth: '100%' }}>
              <div className="welcome-header-wrap">
                <div className="welcome-logo">
                  <Home size={26} />
                </div>
                <h1 className="welcome-brand-title">Frassins Guest Portal</h1>
              </div>
              <h2>{t('welcome_title')}</h2>
              
              <div className="lang-selector-grid">
                <button 
                  type="button" 
                  className={`lang-pill-card ${locale === 'en' ? 'lang-pill-card--active' : ''}`}
                  onClick={() => changeLocale('en')}
                >
                  <div className="lang-pill-card__icon">
                    <Globe size={20} />
                  </div>
                  <span className="lang-pill-card__name">English</span>
                </button>
                <button 
                  type="button" 
                  className={`lang-pill-card ${locale === 'sv' ? 'lang-pill-card--active' : ''}`}
                  onClick={() => changeLocale('sv')}
                >
                  <div className="lang-pill-card__icon">
                    <Globe size={20} />
                  </div>
                  <span className="lang-pill-card__name">Svenska</span>
                </button>
              </div>

              <p className="description">
                {t('welcome_desc')}
              </p>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="setup-btn setup-btn--primary setup-btn--large" 
                  onClick={nextStep}
                  style={{ flex: 1, maxWidth: '240px', minWidth: '180px' }}
                >
                  {t('start_config_btn')}
                </button>
                <label 
                  className="setup-btn setup-btn--secondary setup-btn--large" 
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6, flex: 1, maxWidth: '240px', minWidth: '180px', margin: 0 }}
                >
                  <FolderOpen size={16} />
                  {t('import_backup_btn')}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEG 13: Välj integrationer (nytt grid) */}
          {step === 13 && (
            <div className="setup-card fade-in setup-container--wide-integrations" style={{ maxWidth: '100%' }}>
              <div className="setup-icon-wrapper setup-icon-wrapper--general">
                <Settings size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('select_integrations_title')}</h2>
              <p className="description">
                {t('select_integrations_desc')}
              </p>

              <div className="integration-grid">
                {/* Hue */}
                <div 
                  className={`integration-card ${services.hue ? 'integration-card--active' : ''}`}
                  onClick={() => setServices(prev => ({ ...prev, hue: !prev.hue }))}
                >
                  <div className="integration-card__left">
                    <div className="integration-card__icon-wrap">
                      <Lightbulb className="sidebar-icon-svg sidebar-icon-svg--hue" size={20} />
                    </div>
                    <span className="integration-card__name">{t('hue_name')}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="integration-card__checkbox"
                    checked={services.hue}
                    readOnly
                  />
                </div>

                {/* IKEA */}
                <div 
                  className={`integration-card ${services.ikea ? 'integration-card--active' : ''}`}
                  onClick={() => setServices(prev => ({ ...prev, ikea: !prev.ikea }))}
                >
                  <div className="integration-card__left">
                    <div className="integration-card__icon-wrap">
                      <Sliders className="sidebar-icon-svg sidebar-icon-svg--ikea" size={20} />
                    </div>
                    <span className="integration-card__name">{t('ikea_name')}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="integration-card__checkbox"
                    checked={services.ikea}
                    readOnly
                  />
                </div>

                {/* Govee */}
                <div 
                  className={`integration-card ${services.govee ? 'integration-card--active' : ''}`}
                  onClick={() => setServices(prev => ({ ...prev, govee: !prev.govee }))}
                >
                  <div className="integration-card__left">
                    <div className="integration-card__icon-wrap">
                      <Palette className="sidebar-icon-svg sidebar-icon-svg--govee" size={20} />
                    </div>
                    <span className="integration-card__name">{t('govee_name')}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="integration-card__checkbox"
                    checked={services.govee}
                    readOnly
                  />
                </div>

                {/* Google Cast */}
                <div 
                  className={`integration-card ${services.cast ? 'integration-card--active' : ''}`}
                  onClick={() => setServices(prev => ({ ...prev, cast: !prev.cast }))}
                >
                  <div className="integration-card__left">
                    <div className="integration-card__icon-wrap">
                      <Cast className="sidebar-icon-svg sidebar-icon-svg--cast" size={20} />
                    </div>
                    <span className="integration-card__name">{t('cast_name')}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="integration-card__checkbox"
                    checked={services.cast}
                    readOnly
                  />
                </div>

                {/* Matter */}
                <div 
                  className={`integration-card ${services.matter ? 'integration-card--active' : ''}`}
                  onClick={() => setServices(prev => ({ ...prev, matter: !prev.matter }))}
                >
                  <div className="integration-card__left">
                    <div className="integration-card__icon-wrap">
                      <Cpu className="sidebar-icon-svg sidebar-icon-svg--matter" size={20} />
                    </div>
                    <span className="integration-card__name">{t('matter_name')}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="integration-card__checkbox"
                    checked={services.matter}
                    readOnly
                  />
                </div>
              </div>

              <div className="step-actions" style={{ marginTop: 24 }}>
                <button className="setup-btn setup-btn--text" onClick={prevStep}>
                  {t('back_btn')}
                </button>
                <button 
                  className="setup-btn setup-btn--primary" 
                  onClick={nextStep}
                  disabled={!Object.values(services).some(v => v)}
                >
                  {t('next_btn')}
                </button>
              </div>
            </div>
          )}

          {/* STEG 11: Skapa rum */}
          {step === 11 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--rooms">
                <Home size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('room_builder_title')}</h2>
              <p className="description">
                {t('room_builder_desc')}
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.target.elements.roomInput;
                  const name = input.value.trim();
                  if (name) {
                    handleAddRoomName(name);
                    input.value = '';
                  }
                }}
                className="input-group"
                style={{ margin: '10px 0' }}
              >
                <input
                  name="roomInput"
                  type="text"
                  placeholder={t('room_builder_placeholder')}
                  disabled={loading}
                />
                <button type="submit" className="setup-btn setup-btn--primary" disabled={loading}>
                  {t('room_builder_add_btn')}
                </button>
              </form>

              <div className="room-builder-list">
                {rooms.map((room) => (
                  <span key={room} className="room-builder-pill">
                    <span>{room}</span>
                    <button
                      type="button"
                      className="room-builder-pill__delete"
                      onClick={() => setRooms(rooms.filter(r => r !== room))}
                      title={`${t('room_builder_delete_title')} ${room}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 2: Philips Hue */}
          {step === 2 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--hue">
                <Lightbulb size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('hue_bridge_title')}</h2>
              <p className="description">
                {t('hue_bridge_desc')}
              </p>

              <div className="form-group">
                <label>{t('hue_ip_label')}</label>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.50"
                    value={hue.ip}
                    onChange={(e) => {
                      setHue({ ...hue, ip: e.target.value })
                      setError(null)
                    }}
                    disabled={hue.paired}
                  />
                  <button 
                    type="button" 
                    className="setup-btn setup-btn--secondary" 
                    onClick={discoverHue}
                    disabled={loading || hue.paired}
                  >
                    {t('hue_auto_search')}
                  </button>
                </div>
              </div>

              {hue.paired ? (
                <div className="setup-success-badge">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>{t('hue_paired_badge', { count: hueLights.length })}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="setup-btn setup-btn--primary"
                  onClick={pairHue}
                  disabled={loading || !hue.ip}
                >
                  {loading ? <span className="spinner" /> : t('hue_pair_action_btn')}
                </button>
              )}

              {/* Välj lampor och rum */}
              {hue.paired && (
                <div className="mapping-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>{t('hue_mapping_title')}</h3>
                    <button
                      type="button"
                      className="setup-btn setup-btn--secondary"
                      onClick={() => fetchHueLights(hue.ip, hue.apiKey)}
                      disabled={loading}
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                      <span>{t('hue_search_again')}</span>
                    </button>
                  </div>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    {t('hue_mapping_desc')}
                  </p>
                  <LightConfigurator lights={hueLights} onChange={updateHueLight} rooms={rooms} onAddRoom={handleAddRoomName} t={t} />
                </div>
              )}

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 3: IKEA Smart Home */}
          {step === 3 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--ikea">
                <Sliders size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('ikea_title')}</h2>
              <p className="description">
                {t('ikea_desc')}
              </p>

              <div className="bridge-selector">
                <button
                  type="button"
                  className={`selector-btn ${ikea.type === 'dirigera' ? 'active' : ''}`}
                  onClick={() => setIkea({ ...ikea, type: 'dirigera', paired: false })}
                >
                  <Zap size={16} /> {t('ikea_dirigera_tab')}
                </button>
                <button
                  type="button"
                  className={`selector-btn ${ikea.type === 'tradfri' ? 'active' : ''}`}
                  onClick={() => setIkea({ ...ikea, type: 'tradfri', paired: false })}
                >
                  <Server size={16} /> {t('ikea_tradfri_tab')}
                </button>
              </div>

              <div className="form-group">
                <label>{t('ikea_ip_label')}</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.60"
                  value={ikea.ip}
                  onChange={(e) => {
                    setIkea({ ...ikea, ip: e.target.value })
                    setError(null)
                  }}
                  disabled={ikea.paired}
                />
              </div>

              {ikea.type === 'dirigera' ? (
                <div className="form-group">
                  <label>{t('ikea_dirigera_pin_label')}</label>
                  <input
                    type="text"
                    placeholder="e.g. 123 456 789"
                    value={ikea.code}
                    onChange={(e) => {
                      setIkea({ ...ikea, code: e.target.value })
                      setError(null)
                    }}
                    disabled={ikea.paired}
                  />
                  <span className="text-xs text-dim">{t('ikea_dirigera_pin_desc')}</span>
                </div>
              ) : (
                <div className="form-group">
                  <label>{t('ikea_tradfri_code_label')}</label>
                  <input
                    type="password"
                    placeholder={t('ikea_tradfri_code_label')}
                    value={ikea.securityCode}
                    onChange={(e) => {
                      setIkea({ ...ikea, securityCode: e.target.value })
                      setError(null)
                    }}
                    disabled={ikea.paired}
                  />
                  <span className="text-xs text-dim">{t('ikea_tradfri_code_desc')}</span>
                </div>
              )}

              {ikea.paired ? (
                <div className="setup-success-badge">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>{t('ikea_paired_badge', { count: ikeaLights.length })}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="setup-btn setup-btn--primary"
                  onClick={pairIkea}
                  disabled={loading || !ikea.ip}
                >
                  {t('ikea_pair_action_btn')}
                </button>
              )}

              {ikea.paired && (
                <div className="mapping-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>{t('ikea_mapping_title')}</h3>
                    <button
                      type="button"
                      className="setup-btn setup-btn--secondary"
                      onClick={() => fetchIkeaLights(ikea.type, ikea.ip, ikea.token, ikea.identity, ikea.psk)}
                      disabled={loading}
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                      <span>{t('hue_search_again')}</span>
                    </button>
                  </div>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    {t('ikea_mapping_desc')}
                  </p>
                  <LightConfigurator lights={ikeaLights} onChange={updateIkeaLight} rooms={rooms} onAddRoom={handleAddRoomName} t={t} />
                </div>
              )}

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 4: Govee Cloud API */}
          {step === 4 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--govee">
                <Palette size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('govee_title')}</h2>
              <p className="description">
                {t('govee_desc')}
              </p>

              <div className="form-group">
                <label>{t('govee_api_key_label')}</label>
                <input
                  type="password"
                  placeholder={t('govee_api_key_label')}
                  value={govee.apiKey}
                  onChange={(e) => setGovee({ ...govee, apiKey: e.target.value })}
                  disabled={govee.paired}
                />
              </div>

              {govee.paired ? (
                <div className="setup-success-badge">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>{t('govee_paired_badge', { count: goveeLights.length })}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="setup-btn setup-btn--primary"
                  onClick={testGovee}
                  disabled={loading || !govee.apiKey}
                >
                  {t('govee_test_action_btn')}
                </button>
              )}

              {govee.paired && (
                <div className="mapping-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>{t('govee_mapping_title')}</h3>
                    <button
                      type="button"
                      className="setup-btn setup-btn--secondary"
                      onClick={() => fetchGoveeLights(govee.apiKey)}
                      disabled={loading}
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                      <span>{t('hue_search_again')}</span>
                    </button>
                  </div>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    {t('govee_mapping_desc')}
                  </p>
                  <LightConfigurator lights={goveeLights} onChange={updateGoveeLight} rooms={rooms} onAddRoom={handleAddRoomName} t={t} />
                </div>
              )}

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 6: Google Cast */}
          {step === 6 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--cast">
                <Cast size={32} className="setup-icon-svg" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ margin: 0 }}>{t('cast_title')}</h2>
                {castList.some(c => c.ip) && (
                  <button
                    type="button"
                    className="setup-btn setup-btn--secondary"
                    onClick={testAllCastDevices}
                    disabled={loading}
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                    <span>{t('cast_test_all_btn')}</span>
                  </button>
                )}
              </div>
              <p className="description">
                {t('cast_desc')}
              </p>

              <div className="cast-devices-list">
                {castList.map((cast, index) => (
                  <div key={index} className="cast-device-card">
                    <div className="form-group">
                      <label>{t('cast_device_name_label')}</label>
                      <input
                        type="text"
                        placeholder={t('cast_device_name_placeholder')}
                        value={cast.name}
                        onChange={(e) => handleCastChange(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('cast_ip_label')}</label>
                      <div className="input-group">
                        <input
                          type="text"
                          placeholder={t('cast_ip_placeholder')}
                          value={cast.ip}
                          onChange={(e) => handleCastChange(index, 'ip', e.target.value)}
                        />
                        <button
                          type="button"
                          className="setup-btn setup-btn--secondary"
                          onClick={() => testCastDevice(index)}
                          disabled={cast.loading || !cast.ip}
                        >
                          {cast.loading ? <span className="spinner" /> : t('cast_test_btn')}
                        </button>
                      </div>
                    </div>

                    {cast.tested && (
                      <div className="setup-success-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> {t('cast_test_success')}
                      </div>
                    )}
                    {cast.error && (
                      <div className="setup-error-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {cast.error}
                      </div>
                    )}

                    {castList.length > 1 && (
                      <button
                        type="button"
                        className="remove-cast-btn"
                        onClick={() => removeCastDevice(index)}
                      >
                        {t('cast_remove_btn')}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="setup-btn setup-btn--secondary"
                style={{ width: '100%', marginTop: 8 }}
                onClick={addCastDevice}
              >
                {t('cast_add_btn')}
              </button>

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 10: Matter Setup */}
          {step === 10 && (
            <div className="setup-card fade-in" style={{ maxWidth: '100%' }}>
              <div className="setup-icon-wrapper setup-icon-wrapper--matter">
                <Cpu size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('matter_title')}</h2>
              <p className="description">
                {t('matter_desc')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button
                  type="button"
                  className="setup-btn setup-btn--secondary"
                  onClick={discoverMatterDevices}
                  disabled={matterScan.loading || loading}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {matterScan.loading ? (
                    <>
                      <span className="spinner" />
                      <span>{t('matter_searching_status')}</span>
                    </>
                  ) : (
                    <>
                      <Search size={14} />
                      <span>{t('matter_search_btn')}</span>
                    </>
                  )}
                </button>

                {matterScan.devices.length > 0 && (
                  <div className="dynamic-lights-list" style={{ display: 'flex', flexDirection: 'column' }}>
                    {matterScan.devices.map((dev) => (
                      <div key={dev.id} className="cast-device-card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>{dev.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            Discriminator: {dev.discriminator}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`setup-btn ${selectedDevice?.id === dev.id ? 'setup-btn--primary' : 'setup-btn--secondary'}`}
                          style={{ padding: '3px 8px', fontSize: '10px', margin: 0 }}
                          onClick={() => {
                            setSelectedDevice(selectedDevice?.id === dev.id ? null : dev);
                            setError(null);
                          }}
                        >
                          {selectedDevice?.id === dev.id ? t('selected_btn') : t('select_btn')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDevice && (
                  <div className="setup-alert" style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'var(--accent)', padding: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Pin size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                    <span style={{ fontSize: '11px' }}>
                      <strong>{t('matter_selected_device')}</strong> {selectedDevice.name} ({selectedDevice.discriminator})
                    </span>
                  </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <label>{t('matter_pin_label')}</label>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder={t('matter_pin_placeholder')}
                      value={matterCode}
                      onChange={(e) => {
                        setMatterCode(e.target.value.replace(/[^0-9]/g, ''));
                        setError(null);
                      }}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="setup-btn setup-btn--primary"
                      onClick={pairMatterDevice}
                      disabled={loading || !matterCode}
                    >
                      {t('matter_pair_btn')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Konfigurera hittade lampor */}
              {(matterPaired || matterLights.length > 0) && (
                <div className="mapping-section" style={{ marginTop: 24 }}>
                  <h3>{t('matter_mapping_title')}</h3>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    {t('matter_mapping_desc')}
                  </p>
                  <LightConfigurator lights={matterLights} onChange={updateMatterLight} rooms={rooms} onAddRoom={handleAddRoomName} t={t} />
                </div>
              )}

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 8: Guest Wi-Fi & Info */}
          {step === 8 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--wifi">
                <Wifi size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('wifi_title')}</h2>
              <p className="description">
                {t('wifi_desc')}
              </p>

              <div className="form-group">
                <label>{t('wifi_name_label')}</label>
                <input
                  type="text"
                  placeholder={t('wifi_name_placeholder')}
                  value={wifi.name}
                  onChange={(e) => { setWifi({ ...wifi, name: e.target.value }); markDirty() }}
                />
              </div>

              <div className="form-group">
                <label>{t('wifi_password_label')}</label>
                <input
                  type="text"
                  placeholder={t('wifi_password_placeholder')}
                  value={wifi.password}
                  onChange={(e) => { setWifi({ ...wifi, password: e.target.value }); markDirty() }}
                />
              </div>

              <div className="notes-editor-section">
                <h3>{t('notes_section_title')}</h3>
                {notes.map((note, index) => (
                  <div key={index} className="note-edit-row">
                    <input
                      type="text"
                      className="note-emoji-input"
                      value={note.emoji}
                      onChange={(e) => handleNoteChange(index, 'emoji', e.target.value)}
                      placeholder={t('notes_emoji_placeholder')}
                    />
                    <div className="note-text-inputs">
                      <input
                        type="text"
                        className="note-title-input"
                        value={note.title}
                        onChange={(e) => handleNoteChange(index, 'title', e.target.value)}
                        placeholder={t('notes_title_placeholder')}
                      />
                      <textarea
                        className="note-body-input"
                        value={note.text}
                        onChange={(e) => handleNoteChange(index, 'text', e.target.value)}
                        placeholder={t('notes_desc_placeholder')}
                      />
                    </div>
                    <button
                      type="button"
                      className="note-delete-btn"
                      onClick={() => removeNote(index)}
                      style={{ padding: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="setup-btn setup-btn--secondary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={addNote}
                >
                  {t('notes_add_btn')}
                </button>
              </div>

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 14: Codebase Graph */}
          {step === 14 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--graph">
                <Network size={32} className="setup-icon-svg" />
              </div>
              <h2>{t('graph_view_title')}</h2>
              <p className="description" style={{ marginBottom: 24 }}>
                {t('graph_view_desc')}
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '24px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: 24,
                textAlign: 'center'
              }}>
                <Network size={48} style={{ color: '#818cf8', opacity: 0.8, marginBottom: 16 }} />
                <a
                  href="/code-graph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="setup-btn setup-btn--primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '12px 24px',
                    borderRadius: '100px'
                  }}
                >
                  <Network size={18} style={{ strokeWidth: 2.2 }} />
                  {t('open_graph_btn')}
                </a>
              </div>

              <div style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.03)',
                border: '1px solid rgba(59, 130, 246, 0.12)',
                textAlign: 'left',
                fontSize: '13px',
                lineHeight: '1.6',
                marginBottom: 24
              }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#60a5fa',
                  marginTop: 0,
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <HelpCircle size={16} />
                  {t('graph_instruction_title')}
                </h3>
                <p style={{ margin: '0 0 12px 0', color: 'var(--text-2)' }}>
                  {t('graph_instruction_desc')}
                </p>
                <ol style={{ margin: '0 0 16px 0', paddingLeft: '20px', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>{t('graph_instruction_step1')}</li>
                  <li>{t('graph_instruction_step2')}</li>
                  <li>{t('graph_instruction_step3')}</li>
                </ol>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                  {t('graph_instruction_skip')}
                </p>
              </div>

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>{t('next_btn')}</button>
                  </>
                ) : (
                  renderEditStepActions()
                )}
              </div>
            </div>
          )}

          {/* STEG 9: Bekräftelse & Slutför */}
          {step === 9 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--save">
                <Save size={32} className="setup-icon-svg" />
              </div>
              <h2>{initialConfig ? t('save_title_edit') : t('save_title_new')}</h2>
              <p>
                {initialConfig ? t('save_desc_edit') : t('save_desc_new')}
              </p>

              <div className="setup-summary-box">
                <h3>{t('save_summary_title')}</h3>
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Lightbulb size={14} className="sidebar-icon-svg--hue" />
                    <strong>{t('save_summary_hue')}</strong>
                    {hue.paired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> {t('save_summary_ready')} ({hueLights.filter(l => l.enabled).length} {t('save_summary_selected')})
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> {t('save_summary_not_configured')}
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Sliders size={14} className="sidebar-icon-svg--ikea" />
                    <strong>{t('save_summary_ikea')}</strong>
                    {ikea.paired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> {t('save_summary_ready')} ({ikeaLights.filter(l => l.enabled).length} {t('save_summary_selected')})
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> {t('save_summary_not_configured')}
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Palette size={14} className="sidebar-icon-svg--govee" />
                    <strong>{t('save_summary_govee')}</strong>
                    {govee.paired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> {t('save_summary_ready')} ({goveeLights.filter(l => l.enabled).length} {t('save_summary_selected')})
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> {t('save_summary_not_configured')}
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Cpu size={14} className="sidebar-icon-svg--matter" />
                    <strong>{t('save_summary_matter')}</strong>
                    {matterPaired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> {t('save_summary_ready')} ({matterLights.filter(l => l.enabled).length} {t('save_summary_selected')})
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> {t('save_summary_not_configured')}
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Cast size={14} className="sidebar-icon-svg--cast" />
                    <strong>{t('save_summary_cast')}</strong>
                    <span style={{ fontSize: '12px', marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)' }}>
                      {castList.filter(c => c.tested).length} {t('save_summary_devices_ready')}
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Wifi size={14} className="sidebar-icon-svg--wifi" />
                    <strong>{t('save_summary_wifi')}</strong>
                    <span style={{ fontSize: '12px', marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)' }}>
                      "{wifi.name}"
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Home size={14} className="sidebar-icon-svg--rooms" />
                    <strong>{t('save_summary_rooms')}</strong>
                    <span style={{ fontSize: '12px', marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)' }}>
                      {rooms.length} {t('save_summary_created')}
                    </span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="setup-btn setup-btn--primary setup-btn--large"
                style={{ width: '100%', marginTop: 20 }}
                onClick={saveSetup}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : (initialConfig ? t('save_action_btn_edit') : t('save_action_btn_new'))}
              </button>

              <div className="step-actions" style={{ marginTop: 20 }}>
                {!initialConfig ? (
                  <button className="setup-btn setup-btn--text" onClick={prevStep}>{t('back_btn')}</button>
                ) : (
                  <button className="setup-btn setup-btn--text" onClick={() => setStep(100)}>{t('cancel_btn')}</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
