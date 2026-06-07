import { useState } from 'react'
import { Flame, BookOpen, Moon, Sparkles, Loader2, Check } from 'lucide-react'

function getSceneIcon(sceneId) {
  switch (sceneId) {
    case 'mysigt':
      return <Flame size={24} className="scene-btn__icon" style={{ strokeWidth: 2.2, color: '#f59e0b' }} />
    case 'lasning':
      return <BookOpen size={24} className="scene-btn__icon" style={{ strokeWidth: 2.2, color: '#3b82f6' }} />
    case 'god_natt':
      return <Moon size={24} className="scene-btn__icon" style={{ strokeWidth: 2.2, color: '#6366f1' }} />
    case 'valkommen':
      return <Sparkles size={24} className="scene-btn__icon" style={{ strokeWidth: 2.2, color: '#10b981' }} />
    default:
      return <Sparkles size={24} className="scene-btn__icon" style={{ strokeWidth: 2.2, color: 'var(--purple)' }} />
  }
}

export default function SceneGrid({ scenes, onActivate }) {
  // Spåra vilken scen som just aktiverades (för feedback-animation)
  const [activeScene, setActiveScene] = useState(null)
  const [loadingScene, setLoadingScene] = useState(null)

  async function handleSceneClick(scene) {
    if (loadingScene) return
    setLoadingScene(scene.id)

    try {
      await onActivate(scene.id, scene.transition ?? 2)
    } finally {
      setLoadingScene(null)
      setActiveScene(scene.id)
      setTimeout(() => setActiveScene(null), 1500)
    }
  }

  return (
    <div className="scene-grid" role="group" aria-label="Belysningsscener">
      {scenes.map((scene) => {
        const isLoading = loadingScene === scene.id
        const isActive  = activeScene  === scene.id

        return (
          <button
            key={scene.id}
            id={`scene-btn-${scene.id.replace(/\./g, '-')}`}
            className={[
              'scene-btn',
              isLoading ? 'scene-btn--loading' : '',
              isActive  ? 'scene-btn--success' : '',
            ].join(' ')}
            style={{ '--scene-color': scene.color }}
            onClick={() => handleSceneClick(scene)}
            aria-label={`Aktivera scen: ${scene.name}`}
            aria-busy={isLoading}
            disabled={!!loadingScene}
          >
            <div className="scene-btn__icon-wrap" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isLoading ? (
                <Loader2 size={24} className="scene-btn__spinner" />
              ) : isActive ? (
                <Check size={24} className="scene-btn__success-icon" style={{ color: 'var(--green)', strokeWidth: 2.5 }} />
              ) : (
                getSceneIcon(scene.id)
              )}
            </div>
            <span className="scene-btn__name">{scene.name}</span>
            <span className="scene-btn__desc">{scene.description}</span>
          </button>
        )
      })}
    </div>
  )
}
