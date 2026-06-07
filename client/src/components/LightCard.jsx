import { useState, useCallback, useEffect } from 'react'
import { Lightbulb, Plug, Sun, Thermometer, Snowflake } from 'lucide-react'

// Debounce: Väntar `delay`ms efter senaste anrop innan callback körs.
// Används för sliders så att API inte spammas.
function useDebounce(fn, delay = 300) {
  const [timer, setTimer] = useState(null)
  return useCallback((...args) => {
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => fn(...args), delay))
  }, [fn, delay, timer])
}

export default function LightCard({ config, state, onChange }) {
  const isOn         = state?.state === 'on'
  const brightness   = state?.attributes?.brightness ?? 128      // 0-255
  const colorTemp    = state?.attributes?.color_temp ?? 370       // mireds
  const minMireds    = state?.attributes?.min_mireds ?? 153
  const maxMireds    = state?.attributes?.max_mireds ?? 500

  // Konvertera brightness 0-255 → 0-100 %
  const brightnessPercent = Math.round((brightness / 255) * 100)

  // ── Lokalt UI-state för sliders (responsivt utan debounce-fördröjning) ──
  const [localBrightness, setLocalBrightness] = useState(brightness)
  const [localColorTemp, setLocalColorTemp]   = useState(colorTemp)

  // Synka lokalt state när externa states uppdateras (t.ex. via WebSocket)
  useEffect(() => { setLocalBrightness(brightness)  }, [brightness])
  useEffect(() => { setLocalColorTemp(colorTemp) },  [colorTemp])

  // Debounced API-anrop
  const debouncedChangeBrightness = useDebounce(
    (val) => onChange(config.entity_id, { state: 'on', brightness: val }), 250
  )
  const debouncedChangeColorTemp = useDebounce(
    (val) => onChange(config.entity_id, { color_temp: val }), 250
  )

  function handleToggle() {
    onChange(config.entity_id, { state: isOn ? 'off' : 'on' })
  }

  function handleBrightnessChange(e) {
    const val = Number(e.target.value)
    setLocalBrightness(val)
    debouncedChangeBrightness(val)
  }

  function handleColorTempChange(e) {
    const val = Number(e.target.value)
    setLocalColorTemp(val)
    debouncedChangeColorTemp(val)
  }

  const toggleId = `toggle-${config.entity_id.replace(/\./g, '-')}`

  return (
    <div
      className={`light-card ${isOn ? 'light-card--on' : ''}`}
      style={{ marginBottom: 'var(--space-2)' }}
    >
      {/* ── Header: ikon, namn, toggle ── */}
      <div className="light-card__header">
        <div className="light-card__info">
          <div className="light-card__icon" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {config.isOutlet ? (
              <Plug 
                size={18} 
                style={{ 
                  strokeWidth: 2.2, 
                  color: isOn ? 'var(--amber)' : 'var(--text-3)',
                  opacity: isOn ? 1 : 0.6
                }} 
              />
            ) : (
              <Lightbulb 
                size={18} 
                style={{ 
                  strokeWidth: 2.2, 
                  color: isOn ? 'var(--amber)' : 'var(--text-3)',
                  opacity: isOn ? 1 : 0.6
                }} 
              />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="light-card__name">{config.name}</div>
            <div className="light-card__state">
              {isOn
                ? `På · ${brightnessPercent}% ljusstyrka`
                : 'Av'}
            </div>
          </div>
        </div>

        {/* Toggle-switch */}
        <label className="toggle" htmlFor={toggleId} aria-label={`${config.name}: ${isOn ? 'stäng av' : 'sätt på'}`}>
          <input
            type="checkbox"
            id={toggleId}
            className="toggle__input"
            checked={isOn}
            onChange={handleToggle}
          />
          <span className="toggle__track" />
          <span className="toggle__thumb" />
        </label>
      </div>

      {/* ── Sliders (visas bara när lampan är på) ── */}
      <div className={`light-card__controls ${!isOn ? 'light-card__controls--hidden' : ''}`}>
        {/* Ljusstyrka */}
        {config.supports_brightness && (
          <div className="slider-row">
            <span className="slider-label" aria-hidden="true" title="Ljusstyrka" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sun size={14} style={{ strokeWidth: 2.2 }} />
            </span>
            <input
              type="range"
              id={`brightness-${config.entity_id.replace(/\./g, '-')}`}
              className="slider slider--brightness"
              min="1"
              max="255"
              step="1"
              value={localBrightness}
              onChange={handleBrightnessChange}
              aria-label={`Ljusstyrka för ${config.name}`}
              aria-valuetext={`${brightnessPercent}%`}
            />
            <span className="slider-value">{brightnessPercent}%</span>
          </div>
        )}

        {/* Färgtemperatur */}
        {config.supports_color_temp && (
          <div className="slider-row">
            <span className="slider-label" aria-hidden="true" title="Färgtemperatur" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Thermometer size={14} style={{ strokeWidth: 2.2 }} />
            </span>
            <input
              type="range"
              id={`colortemp-${config.entity_id.replace(/\./g, '-')}`}
              className="slider slider--color-temp"
              min={minMireds}
              max={maxMireds}
              step="1"
              value={localColorTemp}
              onChange={handleColorTempChange}
              aria-label={`Färgtemperatur för ${config.name}`}
            />
            <span className="slider-label" aria-hidden="true" title="Kallt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Snowflake size={14} style={{ strokeWidth: 2.2 }} />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
