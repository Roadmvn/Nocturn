import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

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
    <header
      className="border-b px-6 py-3 flex items-center justify-between shrink-0"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center glow-purple"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-widest text-glow-purple" style={{ color: '#a78bfa' }}>
          NOCTURN
        </span>
        <span className="text-xs px-2 py-1 rounded" style={{ background: '#1e1e2e', color: 'var(--text-muted)' }}>
          C2
        </span>
      </div>

      {/* Center: Nav links */}
      <nav className="flex items-center gap-1">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: isActive('/') ? 'rgba(124,58,237,0.2)' : 'transparent',
            color: isActive('/') ? '#a78bfa' : 'var(--text-muted)',
            border: isActive('/') ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => navigate('/builder')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: isActive('/builder') ? 'rgba(124,58,237,0.2)' : 'transparent',
            color: isActive('/builder') ? '#a78bfa' : 'var(--text-muted)',
            border: isActive('/builder') ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
          }}
        >
          Agent Builder
        </button>
      </nav>

      {/* Right: Time + Logout */}
      <div className="flex items-center gap-4">
        <span
          className="font-mono text-xs px-3 py-1.5 rounded"
          style={{ background: '#0d0d0d', color: '#a78bfa', border: '1px solid var(--border)' }}
        >
          {time.toLocaleTimeString()}
        </span>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: '#f87171',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          Logout
        </button>
      </div>
    </header>
  )
}
