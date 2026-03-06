import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface TransitionCtx {
  transitionTo: (path: string) => void
}

const TransitionContext = createContext<TransitionCtx>({ transitionTo: () => {} })

export function useTransitionNavigate() {
  return useContext(TransitionContext).transitionTo
}

const LABELS: Record<string, string> = {
  '/': 'OPERATIONS CENTER',
  '/builder': 'AGENT BUILDER',
  '/login': 'ACCESS PORTAL',
}

function getLabel(path: string) {
  if (path.startsWith('/agent/')) {
    const id = path.split('/').pop()?.toUpperCase() ?? ''
    return `CONSOLE // ${id}`
  }
  return LABELS[path] ?? path.toUpperCase().replace(/\//g, '')
}

interface OverlayState {
  visible: boolean
  path: string
  progress: number
  leaving: boolean
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [overlay, setOverlay] = useState<OverlayState>({
    visible: false, path: '', progress: 0, leaving: false,
  })

  const transitionTo = useCallback((path: string) => {
    setOverlay({ visible: true, path, progress: 0, leaving: false })

    requestAnimationFrame(() => {
      setTimeout(() => setOverlay(o => ({ ...o, progress: 100 })), 30)
    })

    setTimeout(() => {
      navigate(path)
      setOverlay(o => ({ ...o, leaving: true }))
    }, 480)

    setTimeout(() => {
      setOverlay({ visible: false, path: '', progress: 0, leaving: false })
    }, 780)
  }, [navigate])

  const posStyle = (pos: string): React.CSSProperties => ({
    position: 'absolute',
    width: 24, height: 24,
    ...(pos[0] === 't' ? { top: 28 } : { bottom: 28 }),
    ...(pos[1] === 'l' ? { left: 28 } : { right: 28 }),
    ...(pos[0] === 't'
      ? { borderTop: '1.5px solid rgba(255,101,0,0.5)' }
      : { borderBottom: '1.5px solid rgba(255,101,0,0.5)' }),
    ...(pos[1] === 'l'
      ? { borderLeft: '1.5px solid rgba(255,101,0,0.5)' }
      : { borderRight: '1.5px solid rgba(255,101,0,0.5)' }),
  })

  return (
    <TransitionContext.Provider value={{ transitionTo }}>
      {children}

      {overlay.visible && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(4,4,6,0.97)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 18,
          animation: overlay.leaving ? 'overlay-leave 0.3s ease forwards' : 'overlay-enter 0.12s ease forwards',
          pointerEvents: 'all',
        }}>
          <div className="noise-overlay" />

          {/* Corner brackets */}
          {['tl', 'tr', 'bl', 'br'].map(pos => (
            <div key={pos} style={posStyle(pos)} />
          ))}

          {/* Scan line */}
          <div className="scan-line" />

          {/* Label */}
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, color: 'rgba(255,101,0,0.45)',
            letterSpacing: '0.35em', margin: 0, textTransform: 'uppercase',
          }}>
            // ACCESSING SECURE NODE
          </p>

          {/* Route name */}
          <h2 style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20, fontWeight: 700,
            color: '#FF6500', letterSpacing: '0.2em', margin: 0,
            textShadow: '0 0 30px rgba(255,101,0,0.55)',
          }}>
            {getLabel(overlay.path)}
          </h2>

          {/* Progress bar */}
          <div style={{
            width: 220, height: 2,
            background: 'rgba(255,101,0,0.12)',
            borderRadius: 1, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${overlay.progress}%`,
              background: 'linear-gradient(90deg, #FF6500, #FF9500)',
              boxShadow: '0 0 12px rgba(255,101,0,0.8)',
              transition: 'width 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: 1,
            }} />
          </div>

          {/* Path */}
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, color: 'rgba(255,255,255,0.15)',
            letterSpacing: '0.15em', margin: 0,
          }}>
            {overlay.path}
          </p>
        </div>
      )}
    </TransitionContext.Provider>
  )
}
