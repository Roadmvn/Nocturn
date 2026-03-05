import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface Agent {
  id: string
  cwd: string
  last_seen: number
  status: 'online' | 'idle' | 'offline'
}

function StatusDot({ status }: { status: Agent['status'] }) {
  const colors = {
    online: '#22c55e',
    idle: '#f59e0b',
    offline: '#ef4444',
  }
  return (
    <span
      className="inline-block w-2 h-2 rounded-full mr-2"
      style={{
        background: colors[status],
        boxShadow: status === 'online' ? `0 0 6px ${colors[status]}` : 'none',
        animation: status === 'online' ? 'pulse-dot 2s infinite' : 'none',
      }}
    />
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/agents')
      setAgents(res.data)
      setLastRefresh(new Date())
    } catch {
      // interceptor gère le 401
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 5000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  const logout = () => {
    localStorage.removeItem('nocturn_token')
    navigate('/login')
  }

  const formatLastSeen = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-widest" style={{ color: '#a78bfa' }}>
            NOCTURN
          </span>
          <span className="text-xs px-2 py-1 rounded" style={{ background: '#1e1e2e', color: 'var(--text-muted)' }}>
            C2
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={() => navigate('/builder')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(124,58,237,0.15)',
              color: '#a78bfa',
              border: '1px solid rgba(124,58,237,0.3)',
            }}
          >
            ⚙ Agent Builder
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-8">
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Agents connectés</p>
            <p className="text-3xl font-bold" style={{ color: '#a78bfa' }}>
              {agents.filter(a => a.status !== 'offline').length}
              <span className="text-lg ml-1" style={{ color: 'var(--text-muted)' }}>/ {agents.length}</span>
            </p>
          </div>
          <div
            className="h-12 w-px"
            style={{ background: 'var(--border)' }}
          />
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Online</p>
            <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>
              {agents.filter(a => a.status === 'online').length}
            </p>
          </div>
          <div
            className="h-12 w-px"
            style={{ background: 'var(--border)' }}
          />
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Idle</p>
            <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>
              {agents.filter(a => a.status === 'idle').length}
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={fetchAgents}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              ↻ Rafraîchir
            </button>
          </div>
        </div>

        {/* Agents grid */}
        {loading ? (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            Chargement...
          </div>
        ) : agents.length === 0 ? (
          <div
            className="text-center py-20 rounded-2xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="text-4xl mb-4">🌑</div>
            <h3 className="text-lg font-semibold mb-2">Aucun agent connecté</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              En attente de connexions...
            </p>
            <button
              onClick={() => navigate('/builder')}
              className="mt-6 px-6 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: 'white',
              }}
            >
              Générer un agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl p-5 border transition-all fade-in"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: agent.status === 'online' ? 'rgba(124,58,237,0.3)' : 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <StatusDot status={agent.status} />
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {agent.id}
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: agent.status === 'online'
                        ? 'rgba(34,197,94,0.1)'
                        : agent.status === 'idle'
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(239,68,68,0.1)',
                      color: agent.status === 'online' ? '#22c55e'
                        : agent.status === 'idle' ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {agent.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Répertoire</span>
                    <p className="font-mono text-xs mt-0.5 truncate" style={{ color: '#a78bfa' }}>
                      {agent.cwd}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Dernière activité : {formatLastSeen(agent.last_seen)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/agent/${agent.id}`)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: 'white',
                  }}
                >
                  ⚡ Contrôler
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
