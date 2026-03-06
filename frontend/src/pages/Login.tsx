import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import owlLogo from '../assets/owl.png'

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = 14, t = '1.5px', c = '#FF6500'
  const base: React.CSSProperties = { position: 'absolute', width: s, height: s }
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 0,    left: 0,  borderTop:    `${t} solid ${c}`, borderLeft:   `${t} solid ${c}` },
    tr: { top: 0,    right: 0, borderTop:    `${t} solid ${c}`, borderRight:  `${t} solid ${c}` },
    bl: { bottom: 0, left: 0,  borderBottom: `${t} solid ${c}`, borderLeft:   `${t} solid ${c}` },
    br: { bottom: 0, right: 0, borderBottom: `${t} solid ${c}`, borderRight:  `${t} solid ${c}` },
  }
  return <div style={{ ...base, ...styles[pos] }} />
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('nocturn_token')) navigate('/')
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { username, password })
      localStorage.setItem('nocturn_token', res.data.access_token)
      navigate('/')
    } catch {
      setError('ACCESS DENIED — Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#040406' }}>
      <div className="noise-overlay" />

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,101,0,0.12)',
      }}>
        {/* Radial glow */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(255,101,0,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

        {/* NOCTURN watermark */}
        <div style={{
          position: 'absolute',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 'clamp(80px, 14vw, 140px)',
          fontWeight: 700,
          color: 'rgba(255,101,0,0.04)',
          letterSpacing: '0.15em',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}>
          NOCTURN
        </div>

        {/* Owl */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.88)',
          transition: 'all 0.9s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <img
            src={owlLogo}
            alt="Nocturn"
            style={{
              width: 'clamp(160px, 22vw, 260px)',
              height: 'clamp(160px, 22vw, 260px)',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 30px rgba(255,101,0,0.5)) drop-shadow(0 0 80px rgba(255,101,0,0.15))',
              animation: 'owl-glow-pulse 3s ease-in-out infinite',
            }}
          />
        </div>

        {/* Bottom label */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'rgba(255,101,0,0.35)',
          letterSpacing: '0.3em',
        }}>
          NOCTURN C2 — RESTRICTED
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        width: 'clamp(340px, 40vw, 480px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        background: 'rgba(6,4,8,0.6)',
      }}>
        <div style={{
          width: '100%',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(20px)',
          transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s',
        }}>
          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,101,0,0.5)', letterSpacing: '0.3em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              // ACCESS PORTAL
            </p>
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: '#F0F0F0', letterSpacing: '0.15em', margin: 0, textTransform: 'uppercase' }}>
              OPERATOR LOGIN
            </h2>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #FF6500, transparent)', marginTop: 14 }} />
          </div>

          {/* Form card */}
          <div style={{ position: 'relative', padding: '36px 32px', border: '1px solid rgba(255,101,0,0.12)', borderRadius: 2 }}>
            <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
              {/* Operator ID */}
              <div className="input-group">
                <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>
                  Operator ID
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#FF6500', opacity: 0.6, userSelect: 'none' }}>//</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="enter identifier"
                    required
                    className="login-input"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F0F0F0', letterSpacing: '0.04em' }}
                  />
                </div>
                <div className="input-line" />
              </div>

              {/* Access Key */}
              <div className="input-group">
                <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>
                  Access Key
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#FF6500', opacity: 0.6, userSelect: 'none' }}>//</span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    className="login-input"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F0F0F0', letterSpacing: '0.04em' }}
                  />
                </div>
                <div className="input-line" />
              </div>

              {/* Error */}
              {error && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#FF2D55', background: 'rgba(255,45,85,0.07)', border: '1px solid rgba(255,45,85,0.2)', padding: '10px 14px', letterSpacing: '0.05em', borderRadius: 2 }}>
                  ✕ &nbsp;{error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6, padding: '14px 0',
                  background: loading ? 'transparent' : 'rgba(255,101,0,0.08)',
                  border: `1px solid ${loading ? 'rgba(255,101,0,0.15)' : 'rgba(255,101,0,0.55)'}`,
                  borderRadius: 2, color: loading ? 'rgba(255,255,255,0.2)' : '#FF6500',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  letterSpacing: '0.28em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden', width: '100%',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(255,101,0,0.14)'; e.currentTarget.style.boxShadow = '0 0 18px rgba(255,101,0,0.2)' } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'rgba(255,101,0,0.08)'; e.currentTarget.style.boxShadow = 'none' } }}
              >
                {loading ? '// AUTHENTICATING...' : '// INITIATE ACCESS'}
                {!loading && <div className="btn-scan" />}
              </button>
            </form>
          </div>

          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#2A2030', letterSpacing: '0.1em', textAlign: 'center', marginTop: 24 }}>
            AUTHORIZED USE ONLY
          </p>
        </div>
      </div>
    </div>
  )
}
