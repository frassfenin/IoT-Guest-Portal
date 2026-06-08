import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Trash2, ArrowLeft, Settings, Check, HelpCircle, Home, Lightbulb, Sliders, Palette, Cast, Cpu, Wifi, Save, Power, RefreshCw, Search, Zap, Server, CheckCircle2, AlertCircle, Pin } from 'lucide-react'

function LightConfigurator({ lights, onChange, rooms = [], onAddRoom }) {
  const [newRoomForLight, setNewRoomForLight] = useState({});
  const [showInlineNewRoom, setShowInlineNewRoom] = useState({});

  if (lights.length === 0) {
    return (
      <div className="setup-info-box" style={{ textAlign: 'center', borderStyle: 'solid' }}>
        <p className="text-sm text-dim">Inga lampor hittades. Koppla bron först!</p>
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
                    {light.supports_brightness ? 'Ljusstyrka' : ''}
                    {light.supports_color_temp ? ' • Färgtemp' : ''}
                  </span>
                </div>
              </label>
            </div>
            
            {light.enabled && (
              <div className="light-row-edit fade-in">
                <div className="form-group">
                  <label>Visningsnamn</label>
                  <input
                    type="text"
                    value={light.name}
                    onChange={(e) => onChange(index, 'name', e.target.value)}
                    placeholder="Visningsnamn i portalen"
                  />
                </div>
                <div className="room-select-container">
                  <label>Rum</label>
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
                      <option value="" disabled>-- Välj rum --</option>
                      {rooms.map((room) => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                      <option value="__new__">+ Skapa nytt rum...</option>
                    </select>
                  ) : (
                    <div className="room-new-inline">
                      <input
                        type="text"
                        placeholder="Nytt rum..."
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
                        Ok
                      </button>
                      <button
                        type="button"
                        className="setup-btn setup-btn--secondary"
                        onClick={() => {
                          setShowInlineNewRoom({ ...showInlineNewRoom, [index]: false });
                          setNewRoomForLight({ ...newRoomForLight, [index]: '' });
                        }}
                      >
                        Avbryt
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
    return unique.length > 0 ? unique : ['Vardagsrum', 'Kök', 'Sovrum', 'Hall']
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
    }
  }
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleImportBackup = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target.result)
        if (!config || typeof config !== 'object' || !config.lights) {
          alert('Ogiltig backup-fil! Den måste innehålla en giltig systemkonfiguration.')
          return
        }

        if (!confirm('Är du säker på att du vill importera denna konfiguration? Nuvarande inställningar kommer att skrivas över.')) {
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
          throw new Error(data.error || 'Kunde inte importera backupen')
        }

        alert('Konfigurationen har importerats framgångsrikt!')
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

  const [notes, setNotes] = useState([
    { emoji: '☕', title: 'Kaffemaskinen', text: 'Finns i köket. Kapslar finns i skåpet bredvid.' },
    { emoji: '🧻', title: 'Handdukar', text: 'Färska handdukar finns på hyllan i badrummet.' },
    { emoji: '🔑', title: 'Ytterdörr', text: 'Låser sig automatiskt efter 10 sekunder.' }
  ])

  // ── Prefill från befintlig konfiguration (Edit Mode) ──
  useEffect(() => {
    if (!initialConfig) return

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
        setError('Kunde inte hitta någon Hue Bridge automatiskt på nätverket. Vänligen fyll i IP manuellt.')
      }
    } catch {
      setError('Sökningen misslyckades. Kontrollera nätverket.')
    } finally {
      setLoading(false)
    }
  }

  // ── Hue Pairing ─────────────────────────────────────────
  const pairHue = async () => {
    if (!hue.ip) return setError('Fyll i Hue Bridge IP-adress')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/hue/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: hue.ip })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pairing misslyckades')

      setHue((prev) => ({
        ...prev,
        apiKey: data.apiKey,
        paired: true
      }))

      // Hämta och läs in alla Hue-lampor
      fetchHueLights(hue.ip, data.apiKey)
    } catch (err) {
      setError(err.message === 'link button not pressed'
        ? 'Tryck på den runda knappen på din Philips Hue Bridge först, tryck sedan på "Koppla" här inom 30 sekunder!'
        : `Fel: ${err.message}`
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
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta lampor från Hue Bridge')
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
      setError(`Kunde inte läsa Hue-lampor: ${err.message}`)
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
      setError(`Lokal parning misslyckades: ${err.message}`)
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
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta Matter-lampor')
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
      setError(`Kunde inte läsa Matter-enheter: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── IKEA Hub / Gateway pairing ─────────────────────────
  const pairIkea = async () => {
    if (!ikea.ip) return setError('Fyll i IP-adress för IKEA')
    
    setLoading(true)
    setError(null)
    try {
      if (ikea.type === 'dirigera') {
        if (!ikea.code) return setError('Fyll i den 9-siffriga koden på baksidan')
        const res = await fetch('/api/setup/ikea/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: ikea.ip, code: ikea.code })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Dirigera parning misslyckades')

        setIkea((prev) => ({
          ...prev,
          token: data.token,
          paired: true
        }))
        fetchIkeaLights('dirigera', ikea.ip, data.token)
      } else {
        // Trådfri Gateway (äldre)
        if (!ikea.securityCode) return setError('Fyll i säkerhetskoden (Security Code) under din Gateway')
        const res = await fetch('/api/setup/ikea_tradfri/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: ikea.ip, securityCode: ikea.securityCode })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Trådfri parning misslyckades')

        setIkea((prev) => ({
          ...prev,
          identity: data.identity,
          psk: data.psk,
          paired: true
        }))
        fetchIkeaLights('ikea_tradfri', ikea.ip, null, data.identity, data.psk)
      }
    } catch (err) {
      setError(`Koppling till IKEA misslyckades: ${err.message}`)
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
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta enheter från IKEA')
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
      setError(`Kunde inte läsa IKEA-enheter: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Govee API test ──────────────────────────────────────
  const testGovee = async () => {
    if (!govee.apiKey) return setError('Fyll i din Govee API-nyckel')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/govee/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: govee.apiKey })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Felaktig API-nyckel')

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
      if (!res.ok) throw new Error(data.error || 'Kunde inte hämta enheter från Govee')
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
      setError(`Kunde inte läsa Govee-enheter: ${err.message}`)
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
  }

  const addCastDevice = () => {
    setCastList((prev) => [...prev, { ip: '', name: `Cast Enhet ${prev.length + 1}`, tested: false, error: null, loading: false }])
  }

  const removeCastDevice = (index) => {
    setCastList((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Helper för förändringar i lampor ─────────────────────
  const updateHueLight = (index, field, val) => {
    setHueLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }

  const updateIkeaLight = (index, field, val) => {
    setIkeaLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }

  const updateGoveeLight = (index, field, val) => {
    setGoveeLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }

  const updateMatterLight = (index, field, val) => {
    setMatterLights((prev) => {
      const copy = [...prev]
      copy[index][field] = val
      return copy
    })
  }

  // ── Notes manipulation ───────────────────────────────────
  const handleNoteChange = (index, field, value) => {
    setNotes((prev) => {
      const copy = [...prev]
      copy[index][field] = value
      return copy
    })
  }

  const addNote = () => {
    setNotes((prev) => [...prev, { emoji: '📌', title: 'Ny rubrik', text: 'Skriv text här...' }])
  }

  const removeNote = (index) => {
    setNotes((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Save configuration ──────────────────────────────────
  const saveSetup = async () => {
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
        throw new Error(errData.error || 'Kunde inte spara konfigurationen')
      }

      onComplete()
    } catch (err) {
      setError(`Kunde inte slutföra installationen: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Navigering ──────────────────────────────────────────
  const getActiveStepsList = () => {
    if (initialConfig) {
      return [12, 11, 2, 3, 4, 6, 10, 8, 9]
    }
    const list = [1] // Välkommen
    list.push(11) // Skapa rum
    if (services.hue) list.push(2)
    if (services.ikea) list.push(3)
    if (services.govee) list.push(4)
    if (services.cast) list.push(6)
    if (services.matter) list.push(10) // Matter Setup
    list.push(8) // WiFi & info
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
    { id: 12, name: 'Generella inställningar', iconComponent: Settings, colorClass: 'general', desc: 'Allmänna systeminställningar' },
    { id: 11, name: 'Hantera rum', iconComponent: Home, colorClass: 'rooms', desc: 'Skapa och ta bort rum' },
    { id: 2, name: 'Philips Hue', iconComponent: Lightbulb, colorClass: 'hue', desc: 'Lokal belysning' },
    { id: 3, name: 'IKEA Smart Home', iconComponent: Sliders, colorClass: 'ikea', desc: 'Dirigera Hub / Trådfri' },
    { id: 4, name: 'Govee Lights', iconComponent: Palette, colorClass: 'govee', desc: 'Cloud API belysning' },
    { id: 6, name: 'Google Cast', iconComponent: Cast, colorClass: 'cast', desc: 'Cast-enheter' },
    { id: 10, name: 'Matter-enheter', iconComponent: Cpu, colorClass: 'matter', desc: 'Lokal direktstyrning' },
    { id: 8, name: 'WiFi & info', iconComponent: Wifi, colorClass: 'wifi', desc: 'Gäst-WiFi & Husmanual' },
    { id: 9, name: 'Spara & stäng', iconComponent: Save, colorClass: 'save', desc: 'Spara ändringar' }
  ]

  const getStepName = (stepId) => {
    switch (stepId) {
      case 1: return 'Välkommen'
      case 12: return 'Generella inställningar'
      case 11: return 'Skapa rum'
      case 2: return 'Philips Hue'
      case 3: return 'IKEA Smart Home'
      case 4: return 'Govee Lights'
      case 6: return 'Google Cast'
      case 10: return 'Matter-enheter'
      case 8: return 'WiFi & info'
      case 9: return 'Spara & starta'
      default: return `Steg ${stepId}`
    }
  }

  const renderDashboard = () => {
    return (
      <div className="setup-card fade-in" style={{ maxWidth: '100%' }}>
        <div className="setup-icon-wrapper setup-icon-wrapper--save">
          <Settings size={36} className="setup-icon-svg" />
        </div>
        <h2 style={{ textAlign: 'center' }}>Inställningspanel</h2>
        <p className="description" style={{ textAlign: 'center' }}>
          Välj den kategori eller integration du vill konfigurera nedan. Dina ändringar sparas på systemet när du går till "Spara & stäng".
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
  const isWideContainer = !isMobile && (showSplitLayout || step === 100 || step === 10);
  const containerClass = `setup-container ${isWideContainer ? 'setup-container--wide' : ''}`;

  return (
    <div className={containerClass}>
      <div className="setup-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="setup-title">{initialConfig ? 'Systeminställningar' : 'Systemkonfiguration'}</h1>
          {onCancel && (
            <button
              type="button"
              className="setup-btn setup-btn--cancel"
              onClick={onCancel}
            >
              ✕ Avbryt
            </button>
          )}
        </div>
        {!initialConfig ? (
          <>
            <p className="setup-subtitle">Steg {activeIndex} av {totalActive}</p>
            <div className="setup-progress-bar">
              <div className="setup-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </>
        ) : (
          <p className="setup-subtitle" style={{ textAlign: 'left', marginTop: '4px' }}>
            Hantera dina smarta enheter, rum och nätverksinställningar
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
              ← Tillbaka till översikt
            </button>
          )}

          {step === 100 && renderDashboard()}

          {/* STEG 12: Generella inställningar */}
          {step === 12 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--general">
                <Settings size={32} className="setup-icon-svg" />
              </div>
              <h2>Generella inställningar</h2>
              <p className="description">
                Denna sektion fylls på med allmänna systeminställningar senare.
              </p>
              
              <div className="step-actions" style={{ marginTop: 24 }}>
                {initialConfig ? (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
                ) : (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEG 1: Välkommen */}
          {step === 1 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--rooms">
                <Home size={32} className="setup-icon-svg" />
              </div>
              <h2>Välkommen till Gästportalen!</h2>
              <p>
                Denna guide hjälper dig att ansluta dina smarta lampor och mediaspelare. 
                Vi söker upp, parkopplar och läser in alla dina enheter automatiskt.
              </p>

              <div className="services-selector" style={{ margin: '12px 0 20px' }}>
                <p className="text-xs text-dim font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Välj enheter att konfigurera:
                </p>
                <div className="services-grid">
                  <label className={`service-select-card ${services.hue ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={services.hue}
                      onChange={(e) => setServices({ ...services, hue: e.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    <span className="service-icon"><Lightbulb className="sidebar-icon-svg sidebar-icon-svg--hue" size={24} /></span>
                    <div className="service-info">
                      <span className="service-name">Philips Hue</span>
                      <span className="service-desc">Lokal realtidsbelysning (SSE)</span>
                    </div>
                  </label>

                  <label className={`service-select-card ${services.ikea ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={services.ikea}
                      onChange={(e) => setServices({ ...services, ikea: e.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    <span className="service-icon"><Sliders className="sidebar-icon-svg sidebar-icon-svg--ikea" size={24} /></span>
                    <div className="service-info">
                      <span className="service-name">IKEA Smart Home</span>
                      <span className="service-desc">Dirigera Hub / Trådfri Gateway</span>
                    </div>
                  </label>

                  <label className={`service-select-card ${services.govee ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={services.govee}
                      onChange={(e) => setServices({ ...services, govee: e.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    <span className="service-icon"><Palette className="sidebar-icon-svg sidebar-icon-svg--govee" size={24} /></span>
                    <div className="service-info">
                      <span className="service-name">Govee Lights</span>
                      <span className="service-desc">Integration via Cloud API</span>
                    </div>
                  </label>

                  <label className={`service-select-card ${services.cast ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={services.cast}
                      onChange={(e) => setServices({ ...services, cast: e.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    <span className="service-icon"><Cast className="sidebar-icon-svg sidebar-icon-svg--cast" size={24} /></span>
                    <div className="service-info">
                      <span className="service-name">Google Cast</span>
                      <span className="service-desc">Streamer, Chromecast, Högtalare</span>
                    </div>
                  </label>

                  <label className={`service-select-card ${services.matter ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={services.matter}
                      onChange={(e) => setServices({ ...services, matter: e.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    <span className="service-icon"><Cpu className="sidebar-icon-svg sidebar-icon-svg--matter" size={24} /></span>
                    <div className="service-info">
                      <span className="service-name">Matter-enheter</span>
                      <span className="service-desc">Lokal direktstyrning över LAN (PIN-kod)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  className="setup-btn setup-btn--primary setup-btn--large" 
                  onClick={nextStep}
                  disabled={!Object.values(services).some(v => v)}
                  style={{ flex: 1 }}
                >
                  Starta guiden
                </button>
                <label 
                  className="setup-btn setup-btn--secondary setup-btn--large" 
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6, flex: 1, margin: 0 }}
                >
                  <FolderOpen size={16} />
                  Importera backup
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

          {/* STEG 11: Skapa rum */}
          {step === 11 && (
            <div className="setup-card fade-in">
              <div className="setup-icon-wrapper setup-icon-wrapper--rooms">
                <Home size={32} className="setup-icon-svg" />
              </div>
              <h2>Skapa rum</h2>
              <p className="description">
                Skapa rummen i ditt hem där du har smart belysning. 
                Det gör det enkelt för dina gäster att hitta rätt lampa.
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
                  placeholder="t.ex. Vardagsrum, Kök, Sovrum..."
                  disabled={loading}
                />
                <button type="submit" className="setup-btn setup-btn--primary" disabled={loading}>
                  Lägg till
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
                      title={`Ta bort ${room}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
              <h2>1. Philips Hue Bridge</h2>
              <p className="description">
                Vi kommunicerar lokalt och i realtid med din Hue Bridge. Tryck på den runda länkningsknappen på din Hue Bridge innan du kopplar.
              </p>

              <div className="form-group">
                <label>IP-adress för Bridge</label>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="t.ex. 192.168.1.50"
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
                    Sök automatiskt
                  </button>
                </div>
              </div>

              {hue.paired ? (
                <div className="setup-success-badge">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>Kopplad! Hittade {hueLights.length} lampor på din Philips Hue Bridge.</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="setup-btn setup-btn--primary"
                  onClick={pairHue}
                  disabled={loading || !hue.ip}
                >
                  {loading ? <span className="spinner" /> : 'Tryck på Hue-knappen & Koppla'}
                </button>
              )}

              {/* Välj lampor och rum */}
              {hue.paired && (
                <div className="mapping-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Välj lampor för portalen</h3>
                    <button
                      type="button"
                      className="setup-btn setup-btn--secondary"
                      onClick={() => fetchHueLights(hue.ip, hue.apiKey)}
                      disabled={loading}
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                      <span>Sök igen</span>
                    </button>
                  </div>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    Kryssa i de Hue-lampor dina gäster ska kunna styra, döp dem och placera dem i rum:
                  </p>
                  <LightConfigurator lights={hueLights} onChange={updateHueLight} rooms={rooms} onAddRoom={handleAddRoomName} />
                </div>
              )}

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
              <h2>2. IKEA Smart Home</h2>
              <p className="description">
                Välj om du har den nyare **Dirigera Hub** (med app-anslutning) eller den äldre **Trådfri Gateway** (CoAP-baserad).
              </p>

              <div className="bridge-selector">
                <button
                  type="button"
                  className={`selector-btn ${ikea.type === 'dirigera' ? 'active' : ''}`}
                  onClick={() => setIkea({ ...ikea, type: 'dirigera', paired: false })}
                >
                  <Zap size={16} /> Dirigera Hub (Nyare)
                </button>
                <button
                  type="button"
                  className={`selector-btn ${ikea.type === 'tradfri' ? 'active' : ''}`}
                  onClick={() => setIkea({ ...ikea, type: 'tradfri', paired: false })}
                >
                  <Server size={16} /> Trådfri Gateway (Äldre)
                </button>
              </div>

              <div className="form-group">
                <label>IP-adress för {ikea.type === 'dirigera' ? 'Hub' : 'Gateway'}</label>
                <input
                  type="text"
                  placeholder="t.ex. 192.168.1.60"
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
                  <label>9-siffrig PIN-kod</label>
                  <input
                    type="text"
                    placeholder="t.ex. 123 456 789"
                    value={ikea.code}
                    onChange={(e) => {
                      setIkea({ ...ikea, code: e.target.value })
                      setError(null)
                    }}
                    disabled={ikea.paired}
                  />
                  <span className="text-xs text-dim">Finns tryckt på klistermärket på undersidan av hubben.</span>
                </div>
              ) : (
                <div className="form-group">
                  <label>Säkerhetskod (Security Code)</label>
                  <input
                    type="password"
                    placeholder="Säkerhetskod från undersidan"
                    value={ikea.securityCode}
                    onChange={(e) => {
                      setIkea({ ...ikea, securityCode: e.target.value })
                      setError(null)
                    }}
                    disabled={ikea.paired}
                  />
                  <span className="text-xs text-dim">Koden står bredvid streckkoden på baksidan av din gateway.</span>
                </div>
              )}

              {ikea.paired ? (
                <div className="setup-success-badge">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>Ansluten till IKEA! Hittade {ikeaLights.length} lampor.</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="setup-btn setup-btn--primary"
                  onClick={pairIkea}
                  disabled={loading || !ikea.ip}
                >
                  {loading ? <span className="spinner" /> : 'Koppla IKEA'}
                </button>
              )}

              {ikea.paired && (
                <div className="mapping-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Välj IKEA-lampor för portalen</h3>
                    <button
                      type="button"
                      className="setup-btn setup-btn--secondary"
                      onClick={() => fetchIkeaLights(ikea.type, ikea.ip, ikea.token, ikea.identity, ikea.psk)}
                      disabled={loading}
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                      <span>Sök igen</span>
                    </button>
                  </div>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    Kryssa i de IKEA-lampor dina gäster ska kunna styra, döp dem och placera dem i rum:
                  </p>
                  <LightConfigurator lights={ikeaLights} onChange={updateIkeaLight} rooms={rooms} onAddRoom={handleAddRoomName} />
                </div>
              )}

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
              <h2>3. Govee Lights</h2>
              <p className="description">
                Ange din personliga API-nyckel för att styra dina Govee-slingor eller lampor. 
                Du kan hämta en API-nyckel gratis via Govee Home-mobilappen.
              </p>

              <div className="form-group">
                <label>Govee API-nyckel (API Key)</label>
                <input
                  type="password"
                  placeholder="Fyll i Govee API-nyckel"
                  value={govee.apiKey}
                  onChange={(e) => setGovee({ ...govee, apiKey: e.target.value })}
                  disabled={govee.paired}
                />
              </div>

              {govee.paired ? (
                <div className="setup-success-badge">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>Ansluten till Govee! Hittade {goveeLights.length} enheter.</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="setup-btn setup-btn--primary"
                  onClick={testGovee}
                  disabled={loading || !govee.apiKey}
                >
                  {loading ? <span className="spinner" /> : 'Testa API-nyckel'}
                </button>
              )}

              {govee.paired && (
                <div className="mapping-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Välj Govee-lampor för portalen</h3>
                    <button
                      type="button"
                      className="setup-btn setup-btn--secondary"
                      onClick={() => fetchGoveeLights(govee.apiKey)}
                      disabled={loading}
                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                      <span>Sök igen</span>
                    </button>
                  </div>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    Kryssa i de Govee-lampor dina gäster ska kunna styra, döp dem och placera dem i rum:
                  </p>
                  <LightConfigurator lights={goveeLights} onChange={updateGoveeLight} rooms={rooms} onAddRoom={handleAddRoomName} />
                </div>
              )}

              <div className="step-actions">
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
                <h2 style={{ margin: 0 }}>5. Google Cast (Google Streamer/TV)</h2>
                {castList.some(c => c.ip) && (
                  <button
                    type="button"
                    className="setup-btn setup-btn--secondary"
                    onClick={testAllCastDevices}
                    disabled={loading}
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <RefreshCw size={12} className={loading ? 'setup-btn-spin' : ''} />
                    <span>Testa alla</span>
                  </button>
                )}
              </div>
              <p className="description">
                Lägg till de Google Cast-enheter som gäster ska kunna starta, pausa och styra volym på lokalt.
              </p>

              <div className="cast-devices-list">
                {castList.map((cast, index) => (
                  <div key={index} className="cast-device-card">
                    <div className="form-group">
                      <label>Namn på enheten</label>
                      <input
                        type="text"
                        placeholder="t.ex. Google Streamer"
                        value={cast.name}
                        onChange={(e) => handleCastChange(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>IP-adress</label>
                      <div className="input-group">
                        <input
                          type="text"
                          placeholder="t.ex. 192.168.1.80"
                          value={cast.ip}
                          onChange={(e) => handleCastChange(index, 'ip', e.target.value)}
                        />
                        <button
                          type="button"
                          className="setup-btn setup-btn--secondary"
                          onClick={() => testCastDevice(index)}
                          disabled={cast.loading || !cast.ip}
                        >
                          {cast.loading ? <span className="spinner" /> : 'Testa'}
                        </button>
                      </div>
                    </div>

                    {cast.tested && (
                      <div className="setup-success-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Lyckad TLS-anslutning!
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
                        Ta bort enhet
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
                + Lägg till ytterligare Cast-enhet
              </button>

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
              <h2>Matter-enheter (Lokal direktstyrning)</h2>
              <p className="description">
                Matter gör att du kan ansluta lampor och eluttag helt lokalt över ditt nätverk utan behov av moln eller externa hubbar. 
                Sätt enheten i parningsläge (fabriksåterställ den vid behov), sök eller ange parningskod nedan för att ansluta den.
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
                      <span>Söker oparade enheter (4s)...</span>
                    </>
                  ) : (
                    <>
                      <Search size={14} />
                      <span>Sök oparade enheter på LAN</span>
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
                          {selectedDevice?.id === dev.id ? 'Vald' : 'Välj'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDevice && (
                  <div className="setup-alert" style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'var(--accent)', padding: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Pin size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                    <span style={{ fontSize: '11px' }}>
                      <strong>Vald enhet:</strong> {selectedDevice.name} ({selectedDevice.discriminator})
                    </span>
                  </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Parningskod / PIN-kod (11 eller 21 siffror)</label>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="t.ex. 34905741252"
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
                      Koppla
                    </button>
                  </div>
                </div>
              </div>

              {/* Konfigurera hittade lampor */}
              {(matterPaired || matterLights.length > 0) && (
                <div className="mapping-section" style={{ marginTop: 24 }}>
                  <h3>Konfigurera dina Matter-lampor & uttag</h3>
                  <p className="text-xs text-dim" style={{ marginBottom: 12 }}>
                    Aktivera enheterna du vill visa i gästportalen, ge dem vänliga visningsnamn och placera dem i rätt rum:
                  </p>
                  <LightConfigurator lights={matterLights} onChange={updateMatterLight} rooms={rooms} onAddRoom={handleAddRoomName} />
                </div>
              )}

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
              <h2>6. Gäst-WiFi & Husinformation</h2>
              <p className="description">
                Gästerna kommer att se denna information i Info-fliken. Det gör det enkelt för dem att ansluta utan krångel.
              </p>

              <div className="form-group">
                <label>Gäst-WiFi (SSID)</label>
                <input
                  type="text"
                  placeholder="Skriv WiFi-namn"
                  value={wifi.name}
                  onChange={(e) => setWifi({ ...wifi, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>WiFi-lösenord</label>
                <input
                  type="text"
                  placeholder="Skriv WiFi-lösenord"
                  value={wifi.password}
                  onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                />
              </div>

              <div className="notes-editor-section">
                <h3>Husanteckningar & Regler</h3>
                {notes.map((note, index) => (
                  <div key={index} className="note-edit-row">
                    <input
                      type="text"
                      className="note-emoji-input"
                      value={note.emoji}
                      onChange={(e) => handleNoteChange(index, 'emoji', e.target.value)}
                      placeholder="⚙️"
                    />
                    <div className="note-text-inputs">
                      <input
                        type="text"
                        className="note-title-input"
                        value={note.title}
                        onChange={(e) => handleNoteChange(index, 'title', e.target.value)}
                        placeholder="Titel"
                      />
                      <textarea
                        className="note-body-input"
                        value={note.text}
                        onChange={(e) => handleNoteChange(index, 'text', e.target.value)}
                        placeholder="Beskrivning..."
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
                  + Lägg till anteckning
                </button>
              </div>

              <div className="step-actions" style={{ marginTop: 24 }}>
                {!initialConfig ? (
                  <>
                    <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                    <button className="setup-btn setup-btn--primary" onClick={nextStep}>Nästa</button>
                  </>
                ) : (
                  <button className="setup-btn setup-btn--primary" onClick={() => setStep(100)} style={{ width: '100%' }}>
                    Klar och tillbaka till översikt
                  </button>
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
              <h2>{initialConfig ? 'Spara dina ändringar' : '7. Klar för start!'}</h2>
              <p>
                {initialConfig 
                  ? 'Klicka nedan för att spara dina ändringar på servern och ladda om portalen.'
                  : 'Konfigurationen är klar att sparas på din hemaserver. Detta kommer att starta upp alla lokala anslutningar och gästportalen kommer att gå live direkt.'}
              </p>

              <div className="setup-summary-box">
                <h3>Konfigurationssammanfattning</h3>
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Lightbulb size={14} className="sidebar-icon-svg--hue" />
                    <strong>Philips Hue:</strong>
                    {hue.paired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> Redo ({hueLights.filter(l => l.enabled).length} valda)
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> Ej konfigurerad
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Sliders size={14} className="sidebar-icon-svg--ikea" />
                    <strong>IKEA Smart Home:</strong>
                    {ikea.paired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> Redo ({ikeaLights.filter(l => l.enabled).length} valda)
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> Ej konfigurerad
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Palette size={14} className="sidebar-icon-svg--govee" />
                    <strong>Govee Lights:</strong>
                    {govee.paired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> Redo ({goveeLights.filter(l => l.enabled).length} valda)
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> Ej konfigurerad
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Cpu size={14} className="sidebar-icon-svg--matter" />
                    <strong>Matter-enheter:</strong>
                    {matterPaired ? (
                      <span className="setup-success-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <Check size={14} /> Redo ({matterLights.filter(l => l.enabled).length} valda)
                      </span>
                    ) : (
                      <span className="setup-error-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', marginLeft: 'auto' }}>
                        <AlertCircle size={14} /> Ej konfigurerad
                      </span>
                    )}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Cast size={14} className="sidebar-icon-svg--cast" />
                    <strong>Google Cast:</strong>
                    <span style={{ fontSize: '12px', marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)' }}>
                      {castList.filter(c => c.tested).length} enheter redo
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Wifi size={14} className="sidebar-icon-svg--wifi" />
                    <strong>Gäst-WiFi:</strong>
                    <span style={{ fontSize: '12px', marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)' }}>
                      "{wifi.name}"
                    </span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Home size={14} className="sidebar-icon-svg--rooms" />
                    <strong>Rum:</strong>
                    <span style={{ fontSize: '12px', marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)' }}>
                      {rooms.length} st skapade
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
                {loading ? <span className="spinner" /> : (initialConfig ? 'Spara & Starta om portalen' : 'Spara & Starta gästportalen')}
              </button>

              <div className="step-actions" style={{ marginTop: 20 }}>
                {!initialConfig ? (
                  <button className="setup-btn setup-btn--text" onClick={prevStep}>Bakåt</button>
                ) : (
                  <button className="setup-btn setup-btn--text" onClick={() => setStep(100)}>Avbryt</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
