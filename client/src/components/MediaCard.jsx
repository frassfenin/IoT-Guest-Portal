import { useState, useEffect, useCallback } from 'react'
import { Tv, Speaker, Music, Cast, Play, Pause, Volume1, Volume2 } from 'lucide-react'

function getMediaIcon(iconStr) {
  if (!iconStr) return <Cast size={20} style={{ strokeWidth: 2.2, color: 'var(--blue)' }} />
  const lower = iconStr.toLowerCase()
  if (lower.includes('📡') || lower.includes('cast')) {
    return <Cast size={20} style={{ strokeWidth: 2.2, color: 'var(--blue)' }} />
  }
  if (lower.includes('📺') || lower.includes('tv')) {
    return <Tv size={20} style={{ strokeWidth: 2.2, color: 'var(--blue)' }} />
  }
  if (lower.includes('🔊') || lower.includes('speaker') || lower.includes('högtalare')) {
    return <Speaker size={20} style={{ strokeWidth: 2.2, color: 'var(--blue)' }} />
  }
  return <Music size={20} style={{ strokeWidth: 2.2, color: 'var(--blue)' }} />
}

function useDebounce(fn, delay = 250) {
  const [timer, setTimer] = useState(null)
  return useCallback((...args) => {
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => fn(...args), delay))
  }, [fn, delay, timer])
}

export default function MediaCard({ config, state, onControl }) {
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
              ? 'Inte tillgänglig'
              : isPlaying && mediaTitle
                ? `${mediaArtist ? `${mediaArtist} – ` : ''}${mediaTitle}`
                : isPlaying
                  ? 'Spelar...'
                  : isPaused
                    ? 'Pausad'
                    : 'Stannad'}
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
            aria-label={isPlaying ? `Pausa ${config.name}` : `Spela ${config.name}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? (
              <Pause size={16} style={{ fill: 'currentColor', strokeWidth: 1.5 }} />
            ) : (
              <Play size={16} style={{ fill: 'currentColor', strokeWidth: 1.5, marginLeft: '2px' }} />
            )}
          </button>

          {/* Volymsslider */}
          <div className="media-card__volume">
            <span className="media-card__vol-icon" aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>
              <Volume1 size={14} style={{ strokeWidth: 2.2 }} />
            </span>
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
              aria-label={`Volym för ${config.name}`}
              aria-valuetext={volPct}
            />
            <span className="media-card__vol-icon" aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>
              <Volume2 size={16} style={{ strokeWidth: 2.2 }} />
            </span>
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
