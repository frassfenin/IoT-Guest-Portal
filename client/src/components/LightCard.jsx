import { useState, useEffect } from 'react'
import { Lightbulb, Plug, Sun, Thermometer, Snowflake, Palette } from 'lucide-react'
import useDebounce from '../hooks/useDebounce.js'

export default function LightCard({ config, state, onChange, t }) {
  const translate = t || ((key, replaces = {}) => {
    let str = key
    Object.entries(replaces).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
    return str
  })

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
  const color = state?.attributes?.color ?? '#ffffff'
  const [localColor, setLocalColor] = useState(color)

  // Synka lokalt state när externa states uppdateras (t.ex. via WebSocket)
  useEffect(() => { setLocalBrightness(brightness)  }, [brightness])
  useEffect(() => { setLocalColorTemp(colorTemp) },  [colorTemp])
  useEffect(() => { setLocalColor(color) }, [color])

  // Debounced API-anrop
  const debouncedChangeBrightness = useDebounce(
    (val) => onChange(config.entity_id, { state: 'on', brightness: val }), 250
  )
  const debouncedChangeColorTemp = useDebounce(
    (val) => onChange(config.entity_id, { color_temp: val }), 250
  )
  const debouncedChangeColor = useDebounce(
    (val) => onChange(config.entity_id, { color: val }), 250
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

  function handleColorChange(e) {
    const val = e.target.value
    setLocalColor(val)
    debouncedChangeColor(val)
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
                ? translate('light_status_on', { percent: brightnessPercent })
                : translate('light_status_off')}
            </div>
          </div>
        </div>

        {/* Toggle-switch */}
        <label className="toggle" htmlFor={toggleId} aria-label={`${config.name}: ${isOn ? translate('light_aria_turn_off') : translate('light_aria_turn_on')}`}>
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
            <span className="slider-label" aria-hidden="true" title={translate('brightness')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              aria-label={translate('light_brightness_label', { name: config.name })}
              aria-valuetext={`${brightnessPercent}%`}
            />
            <span className="slider-value">{brightnessPercent}%</span>
          </div>
        )}

        {/* Färgtemperatur */}
        {config.supports_color_temp && (
          <div className="slider-row">
            <span className="slider-label" aria-hidden="true" title={translate('light_color_temp_cold')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Snowflake size={14} style={{ strokeWidth: 2.2 }} />
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
              aria-label={translate('light_color_temp_label', { name: config.name })}
            />
            <span className="slider-label" aria-hidden="true" title={translate('light_color_temp_warm')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Thermometer size={14} style={{ strokeWidth: 2.2 }} />
            </span>
          </div>
        )}

        {/* Färg (Color Picker) */}
        {state?.attributes?.color !== undefined && state?.attributes?.color !== null && (
          <div className="slider-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'var(--space-2)' }}>
            <span className="slider-label" aria-hidden="true" title={translate('light_color_title')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={14} style={{ strokeWidth: 2.2 }} />
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <input
                type="color"
                className="color-picker-input"
                value={localColor}
                onChange={handleColorChange}
                aria-label={translate('light_color_label', { name: config.name })}
                style={{
                  border: 'none',
                  width: '38px',
                  height: '24px',
                  padding: 0,
                  background: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                {localColor}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
