import { useState, useEffect } from 'react'
import { Settings, Sliders, LayoutGrid, Eye, KeyRound, LogOut, Download, Upload } from 'lucide-react'

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

export default function Header({ connected, config, onImportConfig, onOpenOrganizer, onOpenSetupWizard, blurEnabled, onToggleBlur }) {
  const [now, setNow] = useState(new Date())
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleExportConfig = () => {
    setDropdownOpen(false)
    if (!config) return
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gastportal-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  const handleImportConfig = (e) => {
    setDropdownOpen(false)
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result)
        if (!imported || typeof imported !== 'object' || !imported.lights) {
          alert('Ogiltig backup-fil! Den måste innehålla en giltig systemkonfiguration.')
          return
        }

        if (!confirm('Är du säker på att du vill importera denna konfiguration? Nuvarande inställningar kommer att skrivas över.')) {
          return
        }

        if (onImportConfig) {
          await onImportConfig(imported)
          alert('Systemkonfigurationen har importerats framgångsrikt!')
        }
      } catch (err) {
        console.error('Import misslyckades:', err)
        alert(`Kunde inte importera konfigurationen: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

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
              onClick={handleExportConfig}
            >
              <Download size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2 }} />
              Exportera backup
            </button>
            <label 
              className="settings-dropdown__item" 
              role="menuitem"
              style={{ cursor: 'pointer', margin: 0 }}
            >
              <Upload size={16} className="settings-dropdown__icon" style={{ strokeWidth: 2.2 }} />
              Importera backup
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportConfig} 
                style={{ display: 'none' }} 
              />
            </label>
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
            <div className="settings-dropdown__divider" />
            <a 
              href="https://github.com/frassfenin/IoT-Guest-Portal"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-dropdown__item" 
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
            >
              <svg 
                viewBox="0 0 24 24" 
                width="16" 
                height="16" 
                stroke="currentColor" 
                strokeWidth="2.2" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="settings-dropdown__icon"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              GitHub-projekt
            </a>
          </div>
        )}
      </div>
    </header>
  )
}

