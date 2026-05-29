import { useState, useEffect } from 'react'
import { Settings, Sliders, LayoutGrid, Eye, KeyRound, LogOut } from 'lucide-react'

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

export default function Header({ connected, onOpenOrganizer, onOpenSetupWizard, blurEnabled, onToggleBlur }) {
  const [now, setNow] = useState(new Date())
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Uppdatera klockan varje sekund
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Stäng dropdown vid klock utanför
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (event) => {
      if (!event.target.closest('.settings-menu-container')) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const dateStr = formatDate(now)
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

  return (
    <header className="header" role="banner">
      <div className="header__content">
        <p className="header__greeting">{getGreeting()} 👋</p>
        <h1 className="header__title">Hemmaportal</h1>
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
        </div>
      </div>

      <div className="settings-menu-container">
        <button 
          type="button" 
          className="settings-btn-cog"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
          title="Inställningar och administration"
        >
          <Settings size={20} className="settings-btn-cog__icon" />
        </button>

        {dropdownOpen && (
          <div className="settings-dropdown" role="menu">
            <button 
              className="settings-dropdown__item" 
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false)
                if (onOpenSetupWizard) onOpenSetupWizard()
              }}
            >
              <Sliders size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2 }} />
              Inställningsguide
            </button>
            <button 
              className="settings-dropdown__item" 
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false)
                if (onOpenOrganizer) onOpenOrganizer()
              }}
            >
              <LayoutGrid size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2 }} />
              Organisera rum & lampor
            </button>
            <button 
              className="settings-dropdown__item" 
              role="menuitem"
              onClick={() => {
                if (onToggleBlur) onToggleBlur()
              }}
            >
              <Eye size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2 }} />
              Suddig bakgrund: {blurEnabled ? 'PÅ' : 'AV'}
            </button>
            <div className="settings-dropdown__divider" />
            <button 
              className="settings-dropdown__item" 
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false)
                alert('Ändra lösenord är inte tillgängligt i lokalt demoläge.')
              }}
            >
              <KeyRound size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2, color: 'var(--text-3)' }} />
              Ändra lösenord
            </button>
            <button 
              className="settings-dropdown__item" 
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false)
                alert('In- och utloggning hanteras via din lokala nätverksgateway.')
              }}
            >
              <LogOut size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2, color: 'var(--text-3)' }} />
              Logga in / ut
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

