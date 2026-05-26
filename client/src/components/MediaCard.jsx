import { useState, useEffect, useCallback } from 'react'

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
        <div className="media-card__icon-wrap" aria-hidden="true">
          {config.icon}
        </div>
        <div className="media-card__meta">
          <div className="media-card__device">{config.name}</div>
          <div className={`media-card__now-playing ${isPlaying ? 'media-card__now-playing--active' : ''}`}>
            {isUnavailable
              ? 'Inte tillgänglig'
              : isPlaying && mediaTitle
                ? `▶ ${mediaArtist ? `${mediaArtist} – ` : ''}${mediaTitle}`
                : isPlaying
                  ? '▶ Spelar...'
                  : isPaused
                    ? '⏸ Pausad'
                    : 'Stannar'}
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
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>

          {/* Volymsslider */}
          <div className="media-card__volume">
            <span className="media-card__vol-icon" aria-hidden="true">🔈</span>
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
            <span className="media-card__vol-icon" aria-hidden="true">🔊</span>
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
