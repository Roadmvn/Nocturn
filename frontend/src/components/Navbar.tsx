import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import owlLogo from '../assets/owl.png'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const logout = () => {
    localStorage.removeItem('nocturn_token')
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header style={{
      background: 'rgba(4,4,6,0.95)',
      borderBottom: '1px solid rgba(255,101,0,0.12)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>

      {/* Left: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
        <img
          src={owlLogo}
          alt="Nocturn"
          style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(255,101,0,0.5))' }}
        />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.25em',
          color: '#F0F0F0',
          textShadow: '0 0 12px rgba(255,101,0,0.3)',
        }}>
          NOCTURN
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: '0.15em',
          color: '#FF6500',
          background: 'rgba(255,101,0,0.08)',
          border: '1px solid rgba(255,101,0,0.25)',
          borderRadius: 2,
          padding: '2px 6px',
        }}>
          C2
        </span>
      </div>

      {/* Center: Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[
          { label: 'Dashboard', path: '/' },
          { label: 'Agent Builder', path: '/builder' },
        ].map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.1em',
              padding: '6px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive(path) ? '2px solid #FF6500' : '2px solid transparent',
              color: isActive(path) ? '#FF6500' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => { if (!isActive(path)) e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            onMouseLeave={e => { if (!isActive(path)) e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right: Status + Time + Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* OPSEC indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#00ff88',
            boxShadow: '0 0 6px #00ff88',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(0,255,136,0.6)', letterSpacing: '0.15em' }}>
            SECURE
          </span>
        </div>

        {/* Clock */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'rgba(255,101,0,0.7)',
          background: 'rgba(255,101,0,0.05)',
          border: '1px solid rgba(255,101,0,0.12)',
          borderRadius: 2,
          padding: '4px 10px',
          letterSpacing: '0.1em',
        }}>
          {time.toLocaleTimeString('fr-FR')}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.15em',
            padding: '5px 12px',
            background: 'transparent',
            border: '1px solid rgba(255,45,85,0.25)',
            borderRadius: 2,
            color: 'rgba(255,45,85,0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,85,0.08)'; e.currentTarget.style.color = '#FF2D55' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,45,85,0.6)' }}
        >
          // EXIT
        </button>
      </div>
    </header>
  )
}
