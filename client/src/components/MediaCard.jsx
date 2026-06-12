import { useState, useEffect } from 'react'
import { Tv, Speaker, Music, Cast, Play, Pause, Volume1, Volume2 } from 'lucide-react'
import useDebounce from '../hooks/useDebounce.js'

function getMediaIcon(iconStr, color = 'var(--blue)') {
  if (!iconStr) return <Cast size={20} style={{ strokeWidth: 2.2, color }} />
  const lower = iconStr.toLowerCase()
  if (lower.includes('📡') || lower.includes('cast')) {
    return <Cast size={20} style={{ strokeWidth: 2.2, color }} />
  }
  if (lower.includes('📺') || lower.includes('tv')) {
    return <Tv size={20} style={{ strokeWidth: 2.2, color }} />
  }
  if (lower.includes('🔊') || lower.includes('speaker') || lower.includes('högtalare')) {
    return <Speaker size={20} style={{ strokeWidth: 2.2, color }} />
  }
  return <Music size={20} style={{ strokeWidth: 2.2, color }} />
}

export default function MediaCard({ config, state, onControl, t, layout }) {
  const translate = t || ((key, replaces = {}) => {
    let str = key
    Object.entries(replaces).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
    return str
  })

  const isPlaying    = state?.state === 'playing'
  const isPaused     = state?.state === 'paused'
  const isIdle       = !isPlaying && !isPaused
  const volumeLevel  = state?.attributes?.volume_level ?? 0.5
  const mediaTitle   = state?.attributes?.media_title
  const mediaArtist  = state?.attributes?.media_artist
  const isUnavailable = state?.state === 'unavailable' || !state

  // Lokalt state för volymslidern
  const [localVolume, setLocalVolume] = useState(volumeLevel)

  useEffect(() => { setLocalVolume(volumeLevel) }, [volumeLevel])

  const debouncedVolume = useDebounce(
    (val) => onControl(config.entity_id, 'volume_set', val), 300
  )

  function handlePlayPause() {
    if (isPlaying) {
      onControl(config.entity_id, 'media_pause')
    } else {
      onControl(config.entity_id, 'media_play')
    }
  }

  function handleVolumeChange(e) {
    const val = Number(e.target.value)
    setLocalVolume(val)
    debouncedVolume(val)
  }

  const volPct = `${Math.round(localVolume * 100)}%`
  const sliderId = `vol-${config.entity_id.replace(/\./g, '-')}`

  // Render Inline Mode
  if (layout === 'inline') {
    if (isUnavailable) {
      return (
        <div className="media-card--inline media-card--unavailable" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-3)', flexShrink: 0 }}>
            <Cast size={18} style={{ strokeWidth: 2 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{config.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{translate('media_status_unavailable')}</span>
          </div>
        </div>
      )
    }

    const playingText = isPlaying && mediaTitle
      ? `${mediaArtist ? `${mediaArtist} – ` : ''}${mediaTitle}`
      : isPlaying
        ? translate('media_status_playing')
        : isPaused
          ? translate('media_status_paused')
          : translate('media_status_stopped');

    return (
      <div className={`media-card--inline ${isPlaying ? 'media-card--playing' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        {/* Left icon in circle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', flexShrink: 0, boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)' }}>
          {getMediaIcon(config.icon, '#ffffff')}
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto', marginRight: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
            {config.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2', marginTop: '1px' }}>
            {playingText}
          </div>
        </div>

        {/* Play/Pause Button */}
        <button
          id={`playpause-${config.entity_id.replace(/\./g, '-')}`}
          className="media-btn-inline"
          onClick={handlePlayPause}
          aria-label={isPlaying ? translate('media_aria_pause', { name: config.name }) : translate('media_aria_play', { name: config.name })}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0, 0, 0, 0.05)',
            color: 'var(--text-2)',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          {isPlaying ? (
            <Pause size={13} style={{ strokeWidth: 2.2 }} />
          ) : (
            <Play size={13} style={{ strokeWidth: 2.2, marginLeft: '1px' }} />
          )}
        </button>

        {/* Volume controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <input
            type="range"
            id={sliderId}
            className="slider slider--volume"
            style={{ width: '130px', '--vol-pct': volPct }}
            min="0"
            max="1"
            step="0.02"
            value={localVolume}
            onChange={handleVolumeChange}
            aria-label={translate('media_aria_volume', { name: config.name })}
            aria-valuetext={volPct}
          />
        </div>

        {/* Volume value text */}
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', width: '28px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(localVolume * 100)}
        </span>
      </div>
    )
  }

  // Standard Block Mode
  return (
    <div
      className={`media-card ${isPlaying ? 'media-card--playing' : ''}`}
      style={{ marginBottom: 'var(--space-2)', opacity: isUnavailable ? 0.45 : 1 }}
    >
      {/* ── Header ── */}
      <div className="media-card__header">
        <div className="media-card__icon-wrap" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {getMediaIcon(config.icon)}
        </div>
        <div className="media-card__meta">
          <div className="media-card__device">{config.name}</div>
          <div className={`media-card__now-playing ${isPlaying ? 'media-card__now-playing--active' : ''}`}>
            {isUnavailable
              ? translate('media_status_unavailable')
              : isPlaying && mediaTitle
                ? `${mediaArtist ? `${mediaArtist} – ` : ''}${mediaTitle}`
                : isPlaying
                  ? translate('media_status_playing')
                  : isPaused
                    ? translate('media_status_paused')
                    : translate('media_status_stopped')}
          </div>
        </div>
      </div>

      {/* ── Kontroller ── */}
      {!isUnavailable && (
        <div className="media-card__controls">
          {/* Play/Pause */}
          <button
            id={`playpause-${config.entity_id.replace(/\./g, '-')}`}
            className="media-btn media-btn--play"
            onClick={handlePlayPause}
            aria-label={isPlaying ? translate('media_aria_pause', { name: config.name }) : translate('media_aria_play', { name: config.name })}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? (
              <Pause size={16} style={{ strokeWidth: 2.2 }} />
            ) : (
              <Play size={16} style={{ strokeWidth: 2.2, marginLeft: '1px' }} />
            )}
          </button>

          {/* Volymsslider */}
          <div className="media-card__volume">
            <input
              type="range"
              id={sliderId}
              className="slider slider--volume"
              style={{ '--vol-pct': volPct }}
              min="0"
              max="1"
              step="0.02"
              value={localVolume}
              onChange={handleVolumeChange}
              aria-label={translate('media_aria_volume', { name: config.name })}
              aria-valuetext={volPct}
            />
          </div>

          {/* Volymnivå-text */}
          <span className="slider-value" style={{ width: 36 }}>
            {Math.round(localVolume * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}
