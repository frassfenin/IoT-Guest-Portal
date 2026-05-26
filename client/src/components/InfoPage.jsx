import { useState } from 'react'

export default function InfoPage({ info }) {
  const [copied, setCopied] = useState(false)

  async function handleWifiClick() {
    try {
      await navigator.clipboard.writeText(info.wifi_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback om clipboard inte stöds (t.ex. HTTP utan HTTPS)
      const el = document.createElement('textarea')
      el.value = info.wifi_password
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="info-page">

      {/* ── Wi-Fi-kort ── */}
      <section aria-label="Wi-Fi-information">
        <div className="section-header">
          <span className="section-header__title">Wi-Fi</span>
          <div className="section-header__line" />
        </div>

        <div
          className="wifi-card"
          onClick={handleWifiClick}
          role="button"
          tabIndex={0}
          id="wifi-card"
          aria-label="Kopiera Wi-Fi-lösenord"
          onKeyDown={(e) => e.key === 'Enter' && handleWifiClick()}
        >
          <div className="wifi-card__header">
            <div className="wifi-card__icon" aria-hidden="true">📶</div>
            <div>
              <div className="wifi-card__title">Wi-Fi-inloggning</div>
              <div className="wifi-card__hint">Tryck för att kopiera lösenordet</div>
            </div>
          </div>

          <div className="wifi-field">
            <span className="wifi-field__label">Nätverk</span>
            <span className="wifi-field__value">{info.wifi_name}</span>
          </div>
          <div className="wifi-field">
            <span className="wifi-field__label">Lösenord</span>
            <span className="wifi-field__value">{info.wifi_password}</span>
          </div>

          <div className="wifi-card__copy-hint" aria-live="polite">
            {copied ? (
              <span className="wifi-card__copied">✅ Kopierat till urklipp!</span>
            ) : (
              <span>📋 Tryck för att kopiera</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Husmanual / Anteckningar ── */}
      {info.notes?.length > 0 && (
        <section aria-label="Praktisk information">
          <div className="section-header">
            <span className="section-header__title">Nyttigt att veta</span>
            <div className="section-header__line" />
          </div>

          <div className="notes-card">
            {info.notes.map((note, i) => (
              <div key={i} className="note-item">
                <div className="note-item__emoji" aria-hidden="true">
                  {note.emoji}
                </div>
                <div>
                  <div className="note-item__title">{note.title}</div>
                  <div className="note-item__text">{note.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
