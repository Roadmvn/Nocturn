import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'

interface HistoryEntry {
  command: string
  output: string
  cwd: string
  time: string
  isError?: boolean
}

const QUICK_COMMANDS = [
  'whoami', 'hostname', 'dir', 'ipconfig /all',
  'systeminfo', 'tasklist', 'netstat -ano',
  'check-admin', 'net user', 'help',
]

export default function Console() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [command, setCommand] = useState('')
  const [currentCwd, setCurrentCwd] = useState('?')
  const [loading, setLoading] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(`/agents/${id}/history`)
      setHistory(res.data)
      if (res.data.length > 0) {
        setCurrentCwd(res.data[res.data.length - 1].cwd)
      }
    } catch {
      // 401 géré par interceptor
    }
  }, [id])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const clearTerminal = () => setHistory([])

  const sendCommand = async (cmd?: string) => {
    const toSend = (cmd || command).trim()
    if (!toSend || loading) return

    setLoading(true)
    setCommand('')
    setCmdIndex(-1)

    try {
      const res = await api.post(`/agents/${id}/execute`, { command: toSend })
      setCurrentCwd(res.data.cwd || currentCwd)
      setHistory(prev => [...prev, {
        command: toSend,
        output: res.data.output,
        cwd: res.data.cwd || currentCwd,
        time: new Date().toLocaleTimeString(),
        isError: false,
      }])
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setHistory(prev => [...prev, {
        command: toSend,
        output: axiosErr.response?.data?.error || 'Erreur de communication',
        cwd: currentCwd,
        time: new Date().toLocaleTimeString(),
        isError: true,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const cmds = history.map(h => h.command)
      const newIdx = Math.min(cmdIndex + 1, cmds.length - 1)
      setCmdIndex(newIdx)
      setCommand(cmds[cmds.length - 1 - newIdx] || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIdx = Math.max(cmdIndex - 1, -1)
      setCmdIndex(newIdx)
      setCommand(newIdx === -1 ? '' : history[history.length - 1 - newIdx]?.command || '')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-sm px-3 py-1.5 rounded transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}
          >
            ← Dashboard
          </button>
          <span className="text-sm font-bold tracking-widest text-glow-purple" style={{ color: '#a78bfa' }}>
            NOCTURN
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/</span>
          <span className="font-mono text-sm" style={{ color: '#00ff41' }}>{id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 rounded"
            style={{ background: '#0d0d0d', color: '#a78bfa', border: '1px solid var(--border)' }}>
            {currentCwd}
          </span>
          <button
            onClick={clearTerminal}
            className="text-xs px-3 py-1.5 rounded transition-all"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
            title="Effacer le terminal"
          >
            Clear
          </button>
          {loading && (
            <span className="text-xs px-2 py-1 rounded animate-pulse"
              style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
              En cours...
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar historique */}
        <aside
          className="w-56 border-r shrink-0 overflow-y-auto"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>
            Historique
          </div>
          {history.slice().reverse().map((entry, i) => (
            <button
              key={i}
              onClick={() => sendCommand(entry.command)}
              className="w-full text-left px-3 py-2 text-xs font-mono truncate transition-all hover:opacity-80"
              style={{
                color: entry.isError ? '#f87171' : '#a78bfa',
                borderBottom: '1px solid var(--border)',
              }}
              title={entry.command}
            >
              {entry.command}
            </button>
          ))}
        </aside>

        {/* Terminal */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Quick commands */}
          <div
            className="px-4 py-2 flex flex-wrap gap-2 border-b shrink-0"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            {QUICK_COMMANDS.map(cmd => (
              <button
                key={cmd}
                onClick={() => sendCommand(cmd)}
                className="px-3 py-1 rounded text-xs font-mono transition-all hover:opacity-80"
                style={{
                  background: 'rgba(124,58,237,0.15)',
                  color: '#a78bfa',
                  border: '1px solid rgba(124,58,237,0.25)',
                }}
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Output */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            style={{ background: 'var(--bg-terminal)' }}
            onClick={() => inputRef.current?.focus()}
          >
            {history.length === 0 && (
              <div className="terminal-glow opacity-50" style={{ color: '#00ff41' }}>
                NOCTURN C2 — Agent {id} connecté. Tape une commande.
                <span className="cursor-blink ml-1" style={{ color: '#00ff41' }}>█</span>
              </div>
            )}

            {history.map((entry, i) => (
              <div key={i} className="mb-3">
                {/* Prompt */}
                <div className="flex items-center gap-2">
                  <span style={{ color: '#a78bfa' }}>{entry.cwd}&gt;</span>
                  <span className="terminal-glow" style={{ color: '#00ff41' }}>{entry.command}</span>
                  <span className="text-xs ml-auto opacity-40" style={{ color: '#64748b' }}>{entry.time}</span>
                </div>
                {/* Output — rouge si erreur, vert si succès */}
                <pre
                  className="mt-1 ml-4 text-xs whitespace-pre-wrap leading-relaxed"
                  style={{
                    color: entry.isError ? '#f87171' : '#e2e8f0',
                    textShadow: entry.isError ? '0 0 6px rgba(248,113,113,0.4)' : 'none',
                  }}
                >
                  {entry.output}
                </pre>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2">
                <span style={{ color: '#a78bfa' }}>{currentCwd}&gt;</span>
                <span className="cursor-blink" style={{ color: '#00ff41' }}>█</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="flex items-center px-4 py-3 border-t shrink-0"
            style={{ background: '#080808', borderColor: 'var(--border)' }}
          >
            <span className="font-mono text-sm mr-2" style={{ color: '#a78bfa' }}>
              {currentCwd}&gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={loading ? 'En attente de réponse...' : 'Commande...'}
              className="flex-1 bg-transparent outline-none font-mono text-sm terminal-glow"
              style={{ color: '#00ff41' }}
              autoFocus
            />
            {!loading && (
              <span className="cursor-blink font-mono text-sm" style={{ color: '#00ff41' }}>█</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
