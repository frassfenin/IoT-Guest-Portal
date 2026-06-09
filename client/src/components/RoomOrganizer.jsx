import { useState, useEffect } from 'react'
import { 
  Home, Bed, Tv, Sofa, ChefHat, Bath, Key, Flower2, Gamepad2, 
  Lightbulb, Trash2, X, Plus, FolderOpen, ArrowLeft, PlusCircle, MinusCircle,
  ChevronUp, ChevronDown
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

export default function RoomOrganizer({ config, onSave, onClose, t }) {
  const translate = t || ((key, replaces = {}) => {
    let str = key
    Object.entries(replaces).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
    return str
  })

  const fallbackRoomName = 'Övrigt'

  // Initiera unika rum från befintliga lampor och bibehåll sparad ordning om den finns
  const [rooms, setRooms] = useState(() => {
    const existing = config.lights.map((l) => l.room || fallbackRoomName)
    const unique = Array.from(new Set(existing)).filter((r) => r !== fallbackRoomName)
    const savedRooms = config.rooms || []
    if (savedRooms.length === 0) return unique

    const ordered = savedRooms.filter((r) => unique.includes(r))
    const remaining = unique.filter((r) => !savedRooms.includes(r))
    return [...ordered, ...remaining]
  })

  // Skapa en kopia av lamporna för lokal editering
  const [lights, setLights] = useState(() => config.lights)
  
  // Valda rummet ID/namn (standard: fallbackRoomName / Osorterade lampor)
  const [selectedRoom, setSelectedRoom] = useState(fallbackRoomName)
  
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

    if (rooms.includes(formattedName) || formattedName === fallbackRoomName) {
      alert(translate('organizer_room_exists'))
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
    if (!confirm(translate('organizer_room_delete_confirm', { name: roomName }))) {
      return
    }

    // Flytta lampor i rummet till fallbackRoomName
    setLights((prev) =>
      prev.map((l) => (l.room === roomName ? { ...l, room: fallbackRoomName } : l))
    )

    // Ta bort rummet från listan
    setRooms((prev) => prev.filter((r) => r !== roomName))
    
    // Om det raderade rummet var markerat, gå tillbaka till osorterade
    if (selectedRoom === roomName) {
      setSelectedRoom(fallbackRoomName)
      if (isMobile) {
        setMobileView('master')
      }
    }
  }

  // ── Flytta rum upp/ner i listan ─────────────────────────────
  const handleMoveRoom = (roomName, direction) => {
    const index = rooms.indexOf(roomName)
    if (index === -1) return
    const newRooms = [...rooms]
    if (direction === 'up' && index > 0) {
      const temp = newRooms[index - 1]
      newRooms[index - 1] = newRooms[index]
      newRooms[index] = temp
    } else if (direction === 'down' && index < newRooms.length - 1) {
      const temp = newRooms[index + 1]
      newRooms[index + 1] = newRooms[index]
      newRooms[index] = temp
    }
    setRooms(newRooms)
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
      prev.map((l) => (l.entity_id === entity_id ? { ...l, room: fallbackRoomName } : l))
    )
  }

  // ── Spara alla ändringar ─────────────────────────────────────
  const handleSave = () => {
    onSave(lights, rooms)
  }

  // Räkna antal lampor per rum
  const getLightCount = (roomName) => {
    return lights.filter((l) => (l.room || fallbackRoomName) === roomName).length
  }

  // Filtrera aktiva lampor i det valda rummet
  const activeLights = lights.filter((l) => (l.room || fallbackRoomName) === selectedRoom)

  // Filtrera tillgängliga lampor som kan läggas till
  const availableLights = lights.filter((l) => {
    const currentRoom = l.room || fallbackRoomName
    if (currentRoom === selectedRoom) return false // kan inte lägga till om den redan är i rummet

    if (showAllLights) {
      return true // Visa alla lampor i andra rum
    } else {
      return currentRoom === fallbackRoomName // Visa endast osorterade lampor
    }
  })

  // Ikoner & text för det valda rummet
  const ActiveRoomIcon = selectedRoom === fallbackRoomName ? FolderOpen : getRoomIcon(selectedRoom)
  const activeRoomTitle = selectedRoom === fallbackRoomName ? translate('organizer_unassigned_lights') : selectedRoom

  // Rendering av enskild rums-knapp i listan
  const renderRoomItem = (roomName, isFallback = false) => {
    const Icon = isFallback ? FolderOpen : getRoomIcon(roomName)
    const displayName = isFallback ? translate('organizer_unassigned_lights') : roomName
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="rooms-sidebar-item__count">{count}</span>
          {!isFallback && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveRoom(roomName, 'up')
                  }}
                  disabled={rooms.indexOf(roomName) === 0}
                  style={{ 
                    opacity: rooms.indexOf(roomName) === 0 ? 0.25 : 0.7, 
                    cursor: rooms.indexOf(roomName) === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={translate('organizer_move_up')}
                >
                  <ChevronUp size={12} style={{ strokeWidth: 2.5 }} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveRoom(roomName, 'down')
                  }}
                  disabled={rooms.indexOf(roomName) === rooms.length - 1}
                  style={{ 
                    opacity: rooms.indexOf(roomName) === rooms.length - 1 ? 0.25 : 0.7, 
                    cursor: rooms.indexOf(roomName) === rooms.length - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={translate('organizer_move_down')}
                >
                  <ChevronDown size={12} style={{ strokeWidth: 2.5 }} />
                </button>
              </div>
              <button
                type="button"
                className="rooms-sidebar-item__delete"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteRoom(roomName)
                }}
                title={translate('organizer_delete_room', { name: roomName })}
              >
                <Trash2 size={13} style={{ strokeWidth: 2.2 }} />
              </button>
            </>
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
          <span className="unassigned-sidebar__count">
            {translate('organizer_lights_count', { count: activeLights.length })}
          </span>
        </div>

        {/* Sektion 1: Aktiva lampor i rummet */}
        <div className="detail-lights-section">
          <h3>
            <Lightbulb size={14} style={{ strokeWidth: 2.2 }} />
            {translate('organizer_lights_in_room')}
          </h3>
          {activeLights.length === 0 ? (
            <div className="organizer-room-card__empty" style={{ padding: 'var(--space-5)' }}>
              {translate('organizer_no_lights_in_room')}
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
                    title={translate('organizer_remove_from_room')}
                  >
                    <MinusCircle size={15} style={{ strokeWidth: 2.2 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sektion 2: Lägg till lampor (visas ej för fallbacksrummet "Osorterade") */}
        {selectedRoom !== fallbackRoomName && (
          <div className="detail-lights-section" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-4)' }}>
            <div className="detail-lights-section__title-bar">
              <h3>{translate('organizer_available_lights')}</h3>
              
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
                  {translate('organizer_show_all_lights')}
                </label>
              </div>
            </div>

            {availableLights.length === 0 ? (
              <div className="organizer-room-card__empty" style={{ padding: 'var(--space-5)' }}>
                {showAllLights 
                  ? translate('organizer_no_other_lights') 
                  : translate('organizer_no_unassigned_lights')}
              </div>
            ) : (
              <div className="detail-lights-grid">
                {availableLights.map((light) => {
                  const currentRoom = light.room || fallbackRoomName
                  return (
                    <div key={light.entity_id} className="detail-light-card">
                      <div className="detail-light-card__info">
                        <Lightbulb size={16} className="detail-light-card__icon" style={{ strokeWidth: 2.2 }} />
                        <div className="detail-light-card__meta">
                          <span className="detail-light-card__name">{light.name}</span>
                          {currentRoom !== fallbackRoomName && (
                            <span className="detail-light-card__room-badge">{currentRoom}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="detail-light-card__btn detail-light-card__btn--add"
                        onClick={() => handleAddLight(light.entity_id)}
                        title={translate('organizer_add_to_room', { name: selectedRoom })}
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
        {selectedRoom === fallbackRoomName && (
          <div className="organizer-room-card__empty" style={{ borderStyle: 'solid', display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-5)' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-2)' }}>{translate('organizer_unassigned_desc_title')}</span>
            <span>{translate('organizer_unassigned_desc_text')}</span>
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
            <h2 id="organizer-title" className="organizer-title">{translate('organizer_title')}</h2>
            <p className="organizer-subtitle">
              {translate('organizer_subtitle')}
            </p>
          </div>
          <button className="setup-btn setup-btn--secondary" onClick={onClose} aria-label={translate('organizer_back_to_rooms')}>
            <X size={16} style={{ strokeWidth: 2.2, marginRight: 4 }} /> {translate('close_btn')}
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
                    placeholder={translate('organizer_placeholder_mobile')}
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
                {renderRoomItem(fallbackRoomName, true)}
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
                {translate('organizer_back_to_rooms')}
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
                    placeholder={translate('organizer_placeholder_desktop')}
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
                {renderRoomItem(fallbackRoomName, true)}
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
            {translate('cancel_btn')}
          </button>
          <button className="setup-btn setup-btn--primary setup-btn--large" onClick={handleSave} style={{ minWidth: 160 }}>
            {translate('organizer_save_changes')}
          </button>
        </div>

      </div>
    </div>
  )
}
