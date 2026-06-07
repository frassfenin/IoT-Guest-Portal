import { useState, useEffect } from 'react'
import { 
  Home, Bed, Tv, Sofa, ChefHat, Bath, Key, Flower2, Gamepad2, 
  Lightbulb, Trash2, X, Plus, FolderOpen, ArrowLeft, PlusCircle, MinusCircle
} from 'lucide-react'

// Matcher för rumsnamn till Lucide-ikoner (Dashboard Outline-estetik)
function getRoomIcon(roomName) {
  const name = roomName.toLowerCase();
  if (name.includes('kök') || name.includes('mat')) return ChefHat;
  if (name.includes('vardagsrum') || name.includes('soffa')) return Sofa;
  if (name.includes('sovrum') || name.includes('säng')) return Bed;
  if (name.includes('spel') || name.includes('hobby') || name.includes('leka')) return Gamepad2;
  if (name.includes('bad') || name.includes('toa') || name.includes('dusch') || name.includes('tvätt')) return Bath;
  if (name.includes('hall') || name.includes('entré') || name.includes('ytter')) return Key;
  if (name.includes('ute') || name.includes('balkong') || name.includes('trädgård') || name.includes('altan')) return Flower2;
  if (name.includes('tv') || name.includes('media') || name.includes('bio')) return Tv;
  return Home;
}

export default function RoomOrganizer({ config, onSave, onClose }) {
  // Initiera unika rum från befintliga lampor (exkludera 'Övrigt' i huvudlistan)
  const [rooms, setRooms] = useState(() => {
    const existing = config.lights.map((l) => l.room || 'Övrigt')
    const unique = Array.from(new Set(existing)).filter((r) => r !== 'Övrigt')
    return unique
  })

  // Skapa en kopia av lamporna för lokal editering
  const [lights, setLights] = useState(() => config.lights)
  
  // Valda rummet ID/namn (standard: 'Övrigt' / Osorterade lampor)
  const [selectedRoom, setSelectedRoom] = useState('Övrigt')
  
  // Textfält för att skapa rum
  const [newRoomName, setNewRoomName] = useState('')
  
  // Visa lampor från andra rum i tilläggslistan
  const [showAllLights, setShowAllLights] = useState(false)
  
  // Mobil navigering: 'master' (lista över rum) eller 'detail' (lampor i rummet)
  const [mobileView, setMobileView] = useState('master')
  
  // Detektera mobilskärm för responsiv layout (gräns 600px)
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 600 : false
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Skapa nytt rum ──────────────────────────────────────────
  const handleAddRoom = (e) => {
    e.preventDefault()
    const trimmed = newRoomName.trim()
    if (!trimmed) return

    // Byt stor bokstav på första bokstaven för snyggare design
    const formattedName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)

    if (rooms.includes(formattedName) || formattedName === 'Övrigt') {
      alert('Rummet finns redan!')
      return
    }

    setRooms((prev) => [...prev, formattedName])
    setNewRoomName('')
    
    // Välj det nyskapade rummet direkt
    setSelectedRoom(formattedName)
    if (isMobile) {
      setMobileView('detail')
    }
  }

  // ── Radera ett rum ──────────────────────────────────────────
  const handleDeleteRoom = (roomName) => {
    if (!confirm(`Är du säker på att du vill ta bort rummet "${roomName}"? Alla lampor i detta rum blir osorterade.`)) {
      return
    }

    // Flytta lampor i rummet till 'Övrigt'
    setLights((prev) =>
      prev.map((l) => (l.room === roomName ? { ...l, room: 'Övrigt' } : l))
    )

    // Ta bort rummet från listan
    setRooms((prev) => prev.filter((r) => r !== roomName))
    
    // Om det raderade rummet var markerat, gå tillbaka till osorterade
    if (selectedRoom === roomName) {
      setSelectedRoom('Övrigt')
      if (isMobile) {
        setMobileView('master')
      }
    }
  }

  // ── Lägg till lampa i aktivt rum ─────────────────────────────
  const handleAddLight = (entity_id) => {
    setLights((prev) =>
      prev.map((l) => (l.entity_id === entity_id ? { ...l, room: selectedRoom } : l))
    )
  }

  // ── Ta bort lampa från aktivt rum (flytta till Osorterade) ────
  const handleRemoveLight = (entity_id) => {
    setLights((prev) =>
      prev.map((l) => (l.entity_id === entity_id ? { ...l, room: 'Övrigt' } : l))
    )
  }

  // ── Spara alla ändringar ─────────────────────────────────────
  const handleSave = () => {
    onSave(lights)
  }

  // Räkna antal lampor per rum
  const getLightCount = (roomName) => {
    return lights.filter((l) => (l.room || 'Övrigt') === roomName).length
  }

  // Filtrera aktiva lampor i det valda rummet
  const activeLights = lights.filter((l) => (l.room || 'Övrigt') === selectedRoom)

  // Filtrera tillgängliga lampor som kan läggas till
  const availableLights = lights.filter((l) => {
    const currentRoom = l.room || 'Övrigt'
    if (currentRoom === selectedRoom) return false // kan inte lägga till om den redan är i rummet

    if (showAllLights) {
      return true // Visa alla lampor i andra rum
    } else {
      return currentRoom === 'Övrigt' // Visa endast osorterade lampor
    }
  })

  // Ikoner & text för det valda rummet
  const ActiveRoomIcon = selectedRoom === 'Övrigt' ? FolderOpen : getRoomIcon(selectedRoom)
  const activeRoomTitle = selectedRoom === 'Övrigt' ? 'Osorterade lampor' : selectedRoom

  // Rendering av enskild rums-knapp i listan
  const renderRoomItem = (roomName, isFallback = false) => {
    const Icon = isFallback ? FolderOpen : getRoomIcon(roomName)
    const displayName = isFallback ? 'Osorterade lampor' : roomName
    const isActive = selectedRoom === roomName
    const count = getLightCount(roomName)

    return (
      <button
        key={roomName}
        type="button"
        className={`rooms-sidebar-item ${isActive ? 'rooms-sidebar-item--active' : ''}`}
        onClick={() => {
          setSelectedRoom(roomName)
          if (isMobile) {
            setMobileView('detail')
          }
        }}
      >
        <span className="rooms-sidebar-item__title">
          <Icon size={16} style={{ strokeWidth: isActive ? 2.5 : 2.2 }} />
          <span className="rooms-sidebar-item__name">{displayName}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="rooms-sidebar-item__count">{count}</span>
          {!isFallback && (
            <button
              type="button"
              className="rooms-sidebar-item__delete"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteRoom(roomName)
              }}
              title={`Ta bort rummet ${roomName}`}
            >
              <Trash2 size={13} style={{ strokeWidth: 2.2 }} />
            </button>
          )}
        </div>
      </button>
    )
  }

  // Rendering av högerpanelen (Detail pane)
  const renderDetailPane = () => {
    return (
      <div className="room-detail-pane">
        
        {/* Rums-Header */}
        <div className="room-detail-header">
          <div className="room-detail-header__title">
            <ActiveRoomIcon size={22} style={{ strokeWidth: 2.5, color: 'var(--purple-light)' }} />
            <h2>{activeRoomTitle}</h2>
          </div>
          <span className="unassigned-sidebar__count">{activeLights.length} lampor</span>
        </div>

        {/* Sektion 1: Aktiva lampor i rummet */}
        <div className="detail-lights-section">
          <h3>
            <Lightbulb size={14} style={{ strokeWidth: 2.2 }} />
            Lampor i rummet
          </h3>
          {activeLights.length === 0 ? (
            <div className="organizer-room-card__empty" style={{ padding: 'var(--space-5)' }}>
              Inga lampor tilldelade till detta rum. Lägg till lampor nedan!
            </div>
          ) : (
            <div className="detail-lights-grid">
              {activeLights.map((light) => (
                <div key={light.entity_id} className="detail-light-card">
                  <div className="detail-light-card__info">
                    <Lightbulb size={16} className="detail-light-card__icon" style={{ strokeWidth: 2.2 }} />
                    <div className="detail-light-card__meta">
                      <span className="detail-light-card__name">{light.name}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="detail-light-card__btn detail-light-card__btn--remove"
                    onClick={() => handleRemoveLight(light.entity_id)}
                    title="Ta bort från rummet"
                  >
                    <MinusCircle size={15} style={{ strokeWidth: 2.2 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sektion 2: Lägg till lampor (visas ej för fallbacksrummet "Osorterade") */}
        {selectedRoom !== 'Övrigt' && (
          <div className="detail-lights-section" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-4)' }}>
            <div className="detail-lights-section__title-bar">
              <h3>Tillgängliga lampor</h3>
              
              {/* Toggle för att visa lampor från andra rum */}
              <div className="show-all-toggle-container">
                <input
                  id="show-all-checkbox"
                  type="checkbox"
                  checked={showAllLights}
                  onChange={(e) => setShowAllLights(e.target.checked)}
                  className="show-all-toggle-input"
                />
                <label htmlFor="show-all-checkbox" className="show-all-toggle-label">
                  Visa lampor från andra rum
                </label>
              </div>
            </div>

            {availableLights.length === 0 ? (
              <div className="organizer-room-card__empty" style={{ padding: 'var(--space-5)' }}>
                {showAllLights 
                  ? 'Det finns inga andra lampor i systemet.' 
                  : 'Inga osorterade lampor tillgängliga. Markera växlaren ovan för att se lampor i andra rum.'}
              </div>
            ) : (
              <div className="detail-lights-grid">
                {availableLights.map((light) => {
                  const currentRoom = light.room || 'Övrigt'
                  return (
                    <div key={light.entity_id} className="detail-light-card">
                      <div className="detail-light-card__info">
                        <Lightbulb size={16} className="detail-light-card__icon" style={{ strokeWidth: 2.2 }} />
                        <div className="detail-light-card__meta">
                          <span className="detail-light-card__name">{light.name}</span>
                          {currentRoom !== 'Övrigt' && (
                            <span className="detail-light-card__room-badge">{currentRoom}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="detail-light-card__btn detail-light-card__btn--add"
                        onClick={() => handleAddLight(light.entity_id)}
                        title={`Lägg till i ${selectedRoom}`}
                      >
                        <PlusCircle size={15} style={{ strokeWidth: 2.2 }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Hjälptext om man är i Osorterade lampor */}
        {selectedRoom === 'Övrigt' && (
          <div className="organizer-room-card__empty" style={{ borderStyle: 'solid', display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-5)' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-2)' }}>Detta är din inkorg för osorterade lampor.</span>
            <span>För att placera lamporna i ett rum, klicka på önskat rum i listan till vänster och lägg till dem därifrån.</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="organizer-overlay" role="dialog" aria-modal="true" aria-labelledby="organizer-title">
      <div className="organizer-canvas fade-in">
        
        {/* ── Header ── */}
        <div className="organizer-header">
          <div>
            <h2 id="organizer-title" className="organizer-title">Organisera rum &amp; lampor</h2>
            <p className="organizer-subtitle">
              Skapa rum och fördela dina lampor. Klicka på ett rum och lägg till eller ta bort lampor från listan.
            </p>
          </div>
          <button className="setup-btn setup-btn--secondary" onClick={onClose} aria-label="Stäng organisering">
            <X size={16} style={{ strokeWidth: 2.2, marginRight: 4 }} /> Stäng
          </button>
        </div>

        {/* ── Huvudinnehåll (Responsiv Layoutdelning) ── */}
        {isMobile ? (
          /* ── MOBIL LAYOUT (Enspalt med Tillbaka-navigering) ── */
          mobileView === 'master' ? (
            <div className="organizer-mobile-master">
              
              {/* Skapa rum (Mobil) */}
              <form onSubmit={handleAddRoom} className="organizer-room-creator" style={{ marginBottom: 'var(--space-2)' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Skapa rum... (t.ex. Kök)"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                <button type="submit" className="setup-btn setup-btn--primary" disabled={!newRoomName.trim()} style={{ padding: '8px 16px' }}>
                  <Plus size={16} />
                </button>
              </form>

              {/* Rumslista */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {renderRoomItem('Övrigt', true)}
                {rooms.map((r) => renderRoomItem(r, false))}
              </div>
            </div>
          ) : (
            <div className="organizer-mobile-detail">
              <button 
                type="button" 
                className="mobile-back-btn" 
                onClick={() => setMobileView('master')}
              >
                <ArrowLeft size={12} />
                Tillbaka till rum
              </button>
              {renderDetailPane()}
            </div>
          )
        ) : (
          /* ── WIDESCREEN / TABLET LAYOUT (Sida vid Sida) ── */
          <div className="organizer-split-layout">
            
            {/* Vänster spalt: Rumslista & Rums-skapare */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflow: 'hidden' }}>
              
              {/* Skapa rum */}
              <form onSubmit={handleAddRoom} className="organizer-room-creator" style={{ padding: 0, border: 'none', background: 'none' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Skapa nytt rum..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full"
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>
                <button type="submit" className="setup-btn setup-btn--primary" disabled={!newRoomName.trim()} style={{ padding: '6px 12px' }}>
                  <Plus size={14} />
                </button>
              </form>

              {/* Rumslista */}
              <div className="rooms-sidebar">
                {renderRoomItem('Övrigt', true)}
                {rooms.map((r) => renderRoomItem(r, false))}
              </div>
            </div>

            {/* Höger spalt: Rumsdetaljer */}
            {renderDetailPane()}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="organizer-footer">
          <button className="setup-btn setup-btn--secondary setup-btn--large" onClick={onClose}>
            Avbryt
          </button>
          <button className="setup-btn setup-btn--primary setup-btn--large" onClick={handleSave} style={{ minWidth: 160 }}>
            Spara ändringar
          </button>
        </div>

      </div>
    </div>
  )
}
