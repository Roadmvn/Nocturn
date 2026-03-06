import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import owlLogo from '../assets/owl.png'

interface Agent {
  id: string
  cwd: string
  last_seen: number
  status: 'online' | 'idle' | 'offline'
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = 10, t = '1px', c = 'rgba(255,101,0,0.5)'
  const base: React.CSSProperties = { position: 'absolute', width: s, height: s }
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 0,    left: 0,  borderTop:    `${t} solid ${c}`, borderLeft:   `${t} solid ${c}` },
    tr: { top: 0,    right: 0, borderTop:    `${t} solid ${c}`, borderRight:  `${t} solid ${c}` },
    bl: { bottom: 0, left: 0,  borderBottom: `${t} solid ${c}`, borderLeft:   `${t} solid ${c}` },
    br: { bottom: 0, right: 0, borderBottom: `${t} solid ${c}`, borderRight:  `${t} solid ${c}` },
  }
  return <div style={{ ...base, ...styles[pos] }} />
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ position: 'relative', padding: '16px 24px', minWidth: 120 }}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color, margin: 0, textShadow: `0 0 16px ${color}60` }}>
        {value}
      </p>
    </div>
  )
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
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  const activeAgents = agents.filter(a => a.status !== 'offline')
  const onlineAgents = agents.filter(a => a.status === 'online')
  const idleAgents = agents.filter(a => a.status === 'idle')

  const filteredAgents = agents.filter(a =>
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    a.cwd.toLowerCase().includes(search.toLowerCase()) ||
    a.status.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      <div className="noise-overlay" />
      <Navbar />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header row ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,101,0,0.5)', letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              // OPERATIONS CENTER
            </p>
            <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#F0F0F0', letterSpacing: '0.15em', margin: 0, textTransform: 'uppercase' }}>
              ACTIVE AGENTS
            </h1>
          </div>
          <button
            onClick={fetchAgents}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.15em',
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,101,0,0.25)',
              borderRadius: 2,
              color: 'rgba(255,101,0,0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,101,0,0.08)'; e.currentTarget.style.color = '#FF6500' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,101,0,0.6)' }}
          >
            ↻ &nbsp;REFRESH
          </button>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 32, flexWrap: 'wrap' }}>
          <StatBlock label="Agents" value={`${activeAgents.length} / ${agents.length}`} color="#FF6500" />
          <div style={{ width: 1, height: 60, background: 'rgba(255,101,0,0.1)', margin: '0 8px' }} />
          <StatBlock label="Online" value={onlineAgents.length} color="#00ff88" />
          <div style={{ width: 1, height: 60, background: 'rgba(255,101,0,0.1)', margin: '0 8px' }} />
          <StatBlock label="Idle" value={idleAgents.length} color="#FF9500" />
          <div style={{ width: 1, height: 60, background: 'rgba(255,101,0,0.1)', margin: '0 8px' }} />
          <StatBlock label="Offline" value={agents.filter(a => a.status === 'offline').length} color="rgba(255,45,85,0.8)" />
        </div>

        {/* ── Search bar ── */}
        <div style={{ position: 'relative', marginBottom: 28 }} className="input-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(8,4,6,0.8)', border: '1px solid rgba(255,101,0,0.12)', borderRadius: 2 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#FF6500', opacity: 0.5, userSelect: 'none' }}>//</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search agent by ID, path or status..."
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                color: '#F0F0F0', letterSpacing: '0.03em',
              }}
              className="login-input"
            />
            {search && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,101,0,0.5)', letterSpacing: '0.1em' }}>
                {filteredAgents.length} RESULT{filteredAgents.length !== 1 ? 'S' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,101,0,0.4)', letterSpacing: '0.2em' }}>
              // SCANNING...
            </p>
          </div>

        ) : filteredAgents.length === 0 ? (
          /* Empty state */
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            border: '1px solid rgba(255,101,0,0.08)',
            borderRadius: 2, background: 'rgba(8,4,6,0.5)',
            position: 'relative',
          }}>
            <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

            <img
              src={owlLogo}
              alt=""
              style={{ width: 72, height: 72, objectFit: 'contain', opacity: 0.25, marginBottom: 20, filter: 'grayscale(1)' }}
            />
            <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 8px' }}>
              {search ? 'NO RESULTS' : 'NO AGENTS CONNECTED'}
            </h3>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em', margin: '0 0 28px' }}>
              {search ? `no match for "${search}"` : '// awaiting connections...'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/builder')}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                  padding: '10px 24px', background: 'rgba(255,101,0,0.08)',
                  border: '1px solid rgba(255,101,0,0.4)', borderRadius: 2,
                  color: '#FF6500', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,101,0,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,101,0,0.08)' }}
              >
                // DEPLOY AGENT
              </button>
            )}
          </div>

        ) : (
          /* Agent grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filteredAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} onControl={() => navigate(`/agent/${agent.id}`)} formatLastSeen={formatLastSeen} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function AgentCard({ agent, onControl, formatLastSeen }: {
  agent: { id: string; cwd: string; last_seen: number; status: string }
  onControl: () => void
  formatLastSeen: (s: number) => string
}) {
  const statusColor = agent.status === 'online' ? '#00ff88' : agent.status === 'idle' ? '#FF9500' : '#FF2D55'
  const borderColor = agent.status === 'online' ? 'rgba(0,255,136,0.15)' : agent.status === 'idle' ? 'rgba(255,149,0,0.1)' : 'rgba(255,45,85,0.08)'

  return (
    <div
      className="fade-in"
      style={{
        background: 'rgba(8,4,6,0.85)',
        border: `1px solid ${borderColor}`,
        borderRadius: 2,
        padding: '20px',
        position: 'relative',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,101,0,0.25)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(255,101,0,0.05)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = borderColor; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}`, flexShrink: 0, animation: agent.status === 'online' ? 'pulse-dot 2s ease-in-out infinite' : 'none' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#FF6500', letterSpacing: '0.05em' }}>
            {agent.id}
          </span>
        </div>
        <StatusBadge status={agent.status as 'online' | 'idle' | 'offline'} />
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', margin: '0 0 4px' }}>
            Working Directory
          </p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,101,0,0.7)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent.cwd}
          </p>
        </div>
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', margin: '0 0 4px' }}>
            Last Seen
          </p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            {formatLastSeen(agent.last_seen)}
          </p>
        </div>
      </div>

      {/* Control button */}
      <button
        onClick={onControl}
        style={{
          width: '100%', padding: '10px 0',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          background: 'rgba(255,101,0,0.06)',
          border: '1px solid rgba(255,101,0,0.35)',
          borderRadius: 2, color: '#FF6500',
          cursor: 'pointer', transition: 'all 0.2s',
          position: 'relative', overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,101,0,0.14)'; e.currentTarget.style.boxShadow = '0 0 14px rgba(255,101,0,0.15)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,101,0,0.06)'; e.currentTarget.style.boxShadow = 'none' }}
      >
        // CONTROL
      </button>
    </div>
  )
}
