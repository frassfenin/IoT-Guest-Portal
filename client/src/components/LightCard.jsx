import { useState, useEffect } from 'react'
import { Lightbulb, Plug, Sun, Thermometer, Snowflake, Palette, Lamp, ChevronDown } from 'lucide-react'
import useDebounce from '../hooks/useDebounce.js'

function getLightIcon(config, isOn, activeColor) {
  const name = (config.name || '').toLowerCase();
  let IconComponent = Lightbulb;
  
  if (config.isOutlet) {
    IconComponent = Plug;
  } else if (name.includes('skrivbord') || name.includes('desk') || name.includes('läs') || name.includes('bords') || name.includes('natt')) {
    IconComponent = Lamp;
  }
  
  return (
    <IconComponent 
      size={18} 
      style={{ 
        strokeWidth: 2.2, 
        color: activeColor,
        transition: 'color 0.3s ease'
      }} 
    />
  );
}

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

  // ── Kollaps/Expansions-tillstånd för mobil och tablet ──
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const handleHeaderClick = (e) => {
    // Om man klickar i själva toggle-switchen ska inte expansionsläget ändras
    if (e.target.closest('.toggle') || e.target.closest('input[type="checkbox"]')) {
      return
    }
    if (isOn && isMobile) {
      setIsExpanded(prev => !prev)
    }
  }

  const getCompactStatusText = () => {
    if (!isOn) return translate('light_status_off');
    const parts = [translate('status_on')];
    if (config.supports_brightness) {
      parts.push(`${brightnessPercent}%`);
    }
    if (state?.attributes?.color) {
      parts.push(state.attributes.color.toUpperCase());
    } else if (config.supports_color_temp) {
      const kelvin = Math.round(1000000 / localColorTemp);
      parts.push(`${kelvin}K`);
    }
    return parts.join(' • ');
  }

  const toggleId = `toggle-${config.entity_id.replace(/\./g, '-')}`

  // Parse state text
  const rawState = isOn ? translate('status_on') : translate('status_off')
  const stateText = rawState.charAt(0).toUpperCase() + rawState.slice(1).toLowerCase()

  // Compute dynamic styling properties
  let cardStyle = { marginBottom: 'var(--space-2)' }
  let iconBgColor = 'rgba(0, 0, 0, 0.04)'
  let activeColor = '#94a3b8'

  if (isOn) {
    if (state?.attributes?.color) {
      const hex = state.attributes.color;
      let r = 245, g = 158, b = 11;
      if (/^#[0-9A-F]{6}$/i.test(hex)) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      }
      
      cardStyle = {
        ...cardStyle,
        background: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.15) 0%, rgba(${r}, ${g}, ${b}, 0.05) 100%)`,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.45)`,
        boxShadow: `0 8px 24px rgba(${r}, ${g}, ${b}, 0.18), var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)`
      };
      activeColor = hex;
      iconBgColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
    } else if (config.supports_color_temp) {
      const pct = (colorTemp - minMireds) / (maxMireds - minMireds || 1);
      if (pct < 0.4) {
        // Cold (blue)
        cardStyle = {
          ...cardStyle,
          background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.7) 0%, rgba(240, 249, 255, 0.4) 100%)',
          borderColor: 'rgba(56, 189, 248, 0.45)',
          boxShadow: '0 8px 24px rgba(56, 189, 248, 0.15), var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
        };
        activeColor = '#0284c7';
        iconBgColor = 'rgba(56, 189, 248, 0.25)';
      } else {
        // Warm (yellow/amber)
        cardStyle = {
          ...cardStyle,
          background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.75) 0%, rgba(255, 251, 235, 0.45) 100%)',
          borderColor: 'rgba(245, 158, 11, 0.45)',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.18), var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
        };
        activeColor = '#d97706';
        iconBgColor = 'rgba(245, 158, 11, 0.25)';
      }
    } else {
      // Default yellow
      cardStyle = {
        ...cardStyle,
        background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.75) 0%, rgba(255, 251, 235, 0.45) 100%)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.18), var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
      };
      activeColor = '#d97706';
      iconBgColor = 'rgba(245, 158, 11, 0.25)';
    }
  } else {
    // Inactive card (grayed out)
    cardStyle = {
      ...cardStyle,
      background: 'rgba(244, 244, 245, 0.45)',
      borderColor: 'rgba(228, 228, 231, 0.55)',
      boxShadow: 'none',
      opacity: 0.6
    };
    activeColor = '#94a3b8';
    iconBgColor = 'rgba(0, 0, 0, 0.04)';
  }

  const showControls = isOn && (!isMobile || isExpanded);

  return (
    <div
      className={`light-card ${isOn ? 'light-card--on' : ''}`}
      style={cardStyle}
    >
      {/* ── Header: ikon, namn, toggle ── */}
      <div 
        className="light-card__header" 
        onClick={handleHeaderClick}
        style={{ cursor: (isOn && isMobile) ? 'pointer' : 'default' }}
      >
        <div className="light-card__info">
          <div 
            className="light-card__icon" 
            aria-hidden="true" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              background: iconBgColor,
              border: isOn ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}
          >
            {getLightIcon(config, isOn, activeColor)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="light-card__name" style={{ fontWeight: 600 }}>{config.name}</div>
            {isOn && (
              <div className="light-card__state">
                {isMobile && !isExpanded ? getCompactStatusText() : stateText}
              </div>
            )}
          </div>
        </div>

        {/* Toggle-switch med valbar Chevron expansionspil på mobil */}
        <div className="light-card__toggle-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          {isOn && isMobile && (
            <div className={`expand-chevron ${isExpanded ? 'expand-chevron--expanded' : ''}`} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-3)',
              transition: 'transform 0.3s ease',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              <ChevronDown size={16} style={{ strokeWidth: 2.5 }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Sliders (visas bara när lampan är på) ── */}
      <div className={`light-card__controls ${!showControls ? 'light-card__controls--hidden' : ''}`}>
        {/* Ljusstyrka */}
        {config.supports_brightness && (
          <div className="slider-row slider-row--brightness" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              id={`brightness-${config.entity_id.replace(/\./g, '-')}`}
              className="slider slider--brightness"
              style={{ flex: 1, '--brightness-pct': `${brightnessPercent}%` }}
              min="1"
              max="255"
              step="1"
              value={localBrightness}
              onChange={handleBrightnessChange}
              aria-label={translate('light_brightness_label', { name: config.name })}
              aria-valuetext={`${brightnessPercent}%`}
            />
            <span className="slider-value" style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, width: '28px', textAlign: 'right' }}>
              {brightnessPercent}%
            </span>
          </div>
        )}

        {/* Färgtemperatur */}
        {config.supports_color_temp && (
          <div className="slider-row slider-row--color-temp" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              id={`colortemp-${config.entity_id.replace(/\./g, '-')}`}
              className="slider slider--color-temp"
              style={{ flex: 1 }}
              min={minMireds}
              max={maxMireds}
              step="1"
              value={localColorTemp}
              onChange={handleColorTempChange}
              aria-label={translate('light_color_temp_label', { name: config.name })}
            />
          </div>
        )}

        {/* Färg (Color Picker) */}
        {state?.attributes?.color !== undefined && state?.attributes?.color !== null && (
          <div className="slider-row slider-row--color" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'var(--space-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <label 
                className="color-picker-wrapper"
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  cursor: 'pointer',
                  transition: 'transform var(--spring), border-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <input
                  type="color"
                  className="color-picker-input"
                  value={localColor}
                  onChange={handleColorChange}
                  aria-label={translate('light_color_label', { name: config.name })}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <Palette 
                  size={18} 
                  style={{ 
                    color: '#3f3f46',
                    pointerEvents: 'none'
                  }} 
                />
                <span 
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: localColor,
                    border: '2px solid #ffffff',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
                    pointerEvents: 'none'
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
