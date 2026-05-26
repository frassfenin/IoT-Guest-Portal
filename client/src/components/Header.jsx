import { useState, useEffect } from 'react'

// Returnerar en hälsning baserad på tidpunkt
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 5)  return 'God natt'
  if (hour < 10) return 'God morgon'
  if (hour < 12) return 'Förmiddag'
  if (hour < 18) return 'God eftermiddag'
  if (hour < 22) return 'God kväll'
  return 'God natt'
}

// Formatera tid: "21:45"
function formatTime(date) {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

// Formatera datum: "Lördag 24 maj"
function formatDate(date) {
  return date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Header({ connected, onOpenOrganizer }) {
  const [now, setNow] = useState(new Date())

  // Uppdatera klockan varje sekund
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = formatDate(now)
  // Gör första bokstaven stor
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

  return (
    <header className="header" role="banner">
      <p className="header__greeting">{getGreeting()} 👋</p>
      <h1 className="header__title">Gästportal</h1>
      <div className="header__meta">
        <time className="header__time" dateTime={now.toISOString()}>
          {dateCapitalized} · {formatTime(now)}
        </time>
        <div className="header__status" aria-live="polite">
          <span
            className={`status-dot ${connected ? 'status-dot--online' : ''}`}
            title={connected ? 'Ansluten' : 'Frånkopplad'}
          />
          <span>{connected ? 'Ansluten' : 'Frånkopplad'}</span>
        </div>
        {onOpenOrganizer && (
          <button 
            type="button" 
            className="organize-btn"
            onClick={onOpenOrganizer}
            title="Organisera rum och lampor"
          >
            ⚙️ Ändra rum
          </button>
        )}
      </div>
    </header>
  )
}
