import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'

interface Agent {
  id: string
  cwd: string
  last_seen: number
  status: 'online' | 'idle' | 'offline'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/agents')
      setAgents(res.data)
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

  const formatLastSeen = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
  }

  const activeAgents = agents.filter(a => a.status !== 'offline')
  const avgConnectionTime = activeAgents.length > 0
    ? Math.round(activeAgents.reduce((sum, a) => sum + a.last_seen, 0) / activeAgents.length)
    : 0

  const filteredAgents = agents.filter(a =>
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    a.cwd.toLowerCase().includes(search.toLowerCase()) ||
    a.status.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-8">
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Agents connectés</p>
            <p className="text-3xl font-bold text-glow-purple" style={{ color: '#a78bfa' }}>
              {activeAgents.length}
              <span className="text-lg ml-1" style={{ color: 'var(--text-muted)' }}>/ {agents.length}</span>
            </p>
          </div>
          <div className="h-12 w-px" style={{ background: 'var(--border)' }} />
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Online</p>
            <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>
              {agents.filter(a => a.status === 'online').length}
            </p>
          </div>
          <div className="h-12 w-px" style={{ background: 'var(--border)' }} />
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Idle</p>
            <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>
              {agents.filter(a => a.status === 'idle').length}
            </p>
          </div>
          <div className="h-12 w-px" style={{ background: 'var(--border)' }} />
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Temps moy. connexion</p>
            <p className="text-3xl font-bold" style={{ color: '#a78bfa' }}>
              {activeAgents.length > 0 ? formatLastSeen(avgConnectionTime) : '—'}
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

        {/* Search bar */}
        <div className="mb-6 relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            ⌕
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un agent par ID, répertoire ou statut..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all font-mono"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          {search && (
            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              {filteredAgents.length} résultat{filteredAgents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Agents grid */}
        {loading ? (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            Chargement...
          </div>
        ) : filteredAgents.length === 0 ? (
          <div
            className="text-center py-20 rounded-2xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="text-4xl mb-4">🌑</div>
            <h3 className="text-lg font-semibold mb-2">
              {search ? 'Aucun résultat' : 'Aucun agent connecté'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? `Aucun agent ne correspond à "${search}"` : 'En attente de connexions...'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/builder')}
                className="mt-6 px-6 py-2 rounded-lg text-sm font-medium glow-purple"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                }}
              >
                Générer un agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl p-5 border transition-all fade-in"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: agent.status === 'online' ? 'rgba(124,58,237,0.3)' : 'var(--border)',
                  boxShadow: agent.status === 'online' ? '0 0 15px rgba(124,58,237,0.08)' : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {agent.id}
                  </span>
                  <StatusBadge status={agent.status} />
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
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all glow-purple"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: 'white',
                  }}
                >
                  Contrôler
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
