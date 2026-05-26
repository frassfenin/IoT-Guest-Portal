import { useState } from 'react'

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
            <span className="scene-btn__emoji" aria-hidden="true">
              {isLoading ? '⏳' : isActive ? '✅' : scene.emoji}
            </span>
            <span className="scene-btn__name">{scene.name}</span>
            <span className="scene-btn__desc">{scene.description}</span>
          </button>
        )
      })}
    </div>
  )
}
