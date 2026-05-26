import { useState, useCallback } from 'react'

export default function RoomOrganizer({ config, onSave, onClose }) {
  // Initiera unika rum från befintliga lampor
  const [rooms, setRooms] = useState(() => {
    const existing = config.lights.map((l) => l.room || 'Övrigt')
    const unique = Array.from(new Set(existing))
    // Se till att 'Övrigt' alltid finns
    if (!unique.includes('Övrigt')) unique.push('Övrigt')
    return unique
  })

  // Skapa en kopia av lamporna för lokal editering
  const [lights, setLights] = useState(() => config.lights)
  const [newRoomName, setNewRoomName] = useState('')
  const [dragOverRoom, setDragOverRoom] = useState(null)

  // ── Skapa nytt rum ──────────────────────────────────────────
  const handleAddRoom = (e) => {
    e.preventDefault()
    const trimmed = newRoomName.trim()
    if (!trimmed) return

    // Byt stor bokstav på första bokstaven för snyggare design
    const formattedName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)

    if (rooms.includes(formattedName)) {
      alert('Rummet finns redan!')
      return
    }

    setRooms((prev) => [...prev, formattedName])
    setNewRoomName('')
  }

  // ── Radera ett rum ──────────────────────────────────────────
  const handleDeleteRoom = (roomName) => {
    if (roomName === 'Övrigt') {
      alert('Rummet "Övrigt" är en fallback och kan inte raderas.')
      return
    }

    if (!confirm(`Är du säker på att du vill ta bort rummet "${roomName}"? Alla lampor i detta rum kommer att flyttas till "Övrigt".`)) {
      return
    }

    // Flytta lampor i rummet till 'Övrigt'
    setLights((prev) =>
      prev.map((l) => (l.room === roomName ? { ...l, room: 'Övrigt' } : l))
    )

    // Ta bort rummet från listan
    setRooms((prev) => prev.filter((r) => r !== roomName))
  }

  // ── Drag & Drop Handlers ────────────────────────────────────
  const handleDragStart = (e, entity_id) => {
    e.dataTransfer.setData('text/plain', entity_id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, roomName) => {
    e.preventDefault()
    if (dragOverRoom !== roomName) {
      setDragOverRoom(roomName)
    }
  }

  const handleDragLeave = () => {
    setDragOverRoom(null)
  }

  const handleDrop = (e, roomName) => {
    e.preventDefault()
    const entity_id = e.dataTransfer.getData('text/plain')
    if (!entity_id) return

    setLights((prev) =>
      prev.map((l) => (l.entity_id === entity_id ? { ...l, room: roomName } : l))
    )
    setDragOverRoom(null)
  }

  // ── Klick/Touch-flytt för pekskärmar ─────────────────────────
  const handleTouchReassign = (entity_id, targetRoom) => {
    setLights((prev) =>
      prev.map((l) => (l.entity_id === entity_id ? { ...l, room: targetRoom } : l))
    )
  }

  // ── Spara ändringar ──────────────────────────────────────────
  const handleSave = () => {
    onSave(lights)
  }

  return (
    <div className="organizer-overlay" role="dialog" aria-modal="true" aria-labelledby="organizer-title">
      <div className="organizer-canvas fade-in">
        
        {/* ── Header ── */}
        <div className="organizer-header">
          <div>
            <h2 id="organizer-title" className="organizer-title">Organisera rum</h2>
            <p className="organizer-subtitle">
              Skapa nya rum, dra lamporna till rätt rum för drag-and-drop eller välj rum i menyn under lampan.
            </p>
          </div>
          <button className="setup-btn setup-btn--secondary" onClick={onClose} aria-label="Stäng organisering">
            ✕ Stäng
          </button>
        </div>

        {/* ── Skapa nytt rum ── */}
        <form onSubmit={handleAddRoom} className="organizer-room-creator">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="new-room-input" className="visually-hidden">Skapa nytt rum</label>
            <input
              id="new-room-input"
              type="text"
              placeholder="Skriv ett rumsnamn... (t.ex. Kök, Sovrum)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full"
            />
          </div>
          <button type="submit" className="setup-btn setup-btn--primary" disabled={!newRoomName.trim()}>
            ➕ Skapa rum
          </button>
        </form>

        {/* ── Arbetsyta / Sorterings-canvas ── */}
        <div className="organizer-workspace">
          {rooms.map((roomName) => {
            const roomLights = lights.filter((l) => (l.room || 'Övrigt') === roomName)
            const isDraggingOver = dragOverRoom === roomName

            return (
              <div
                key={roomName}
                className={`organizer-room-card ${isDraggingOver ? 'organizer-room-card--dragover' : ''}`}
                onDragOver={(e) => handleDragOver(e, roomName)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, roomName)}
              >
                {/* Rumsnamn & radera-knapp */}
                <div className="organizer-room-card__header">
                  <span className="organizer-room-card__title">
                    🏠 {roomName} <span className="organizer-room-card__count">({roomLights.length})</span>
                  </span>
                  {roomName !== 'Övrigt' && (
                    <button
                      type="button"
                      className="note-delete-btn"
                      onClick={() => handleDeleteRoom(roomName)}
                      title={`Radera rummet ${roomName}`}
                    >
                      🗑️ Radera
                    </button>
                  )}
                </div>

                {/* Droppable area för lampor */}
                <div className="organizer-room-card__dropzone">
                  {roomLights.length === 0 ? (
                    <div className="organizer-room-card__empty">
                      Dra lampor hit...
                    </div>
                  ) : (
                    roomLights.map((light) => (
                      <div
                        key={light.entity_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, light.entity_id)}
                        className="organizer-light-card"
                      >
                        <div className="organizer-light-card__drag-handle">☰</div>
                        <div className="organizer-light-card__info">
                          <span className="organizer-light-card__emoji">💡</span>
                          <span className="organizer-light-card__name">{light.name}</span>
                        </div>

                        {/* Touch/Klick Flyttväljare */}
                        <div className="organizer-light-card__reassign">
                          <span className="reassign-label">Flytta till:</span>
                          <select
                            value={roomName}
                            onChange={(e) => handleTouchReassign(light.entity_id, e.target.value)}
                            className="organizer-select"
                            aria-label={`Flytta lampa ${light.name} till rum`}
                          >
                            {rooms.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div className="organizer-footer">
          <button className="setup-btn setup-btn--secondary setup-btn--large" onClick={onClose}>
            Avbryt
          </button>
          <button className="setup-btn setup-btn--primary setup-btn--large" onClick={handleSave} style={{ minWidth: 160 }}>
            💾 Spara ändringar
          </button>
        </div>

      </div>
    </div>
  )
}
