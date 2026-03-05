interface StatusBadgeProps {
  status: 'online' | 'idle' | 'offline'
  showLabel?: boolean
}

const config = {
  online:  { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   label: 'online' },
  idle:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'idle' },
  offline: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'offline' },
}

export default function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const c = config[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <span className="relative inline-flex items-center justify-center w-2 h-2">
        <span
          className="absolute inline-block w-2 h-2 rounded-full"
          style={{
            background: c.color,
            animation: status === 'online' ? 'pulse-ring 1.5s ease-out infinite' : 'none',
            opacity: status === 'online' ? 0.5 : 0,
          }}
        />
        <span
          className="relative inline-block w-2 h-2 rounded-full"
          style={{
            background: c.color,
            boxShadow: status === 'online' ? `0 0 6px ${c.color}` : 'none',
            animation: status === 'online' ? 'pulse-dot 2s infinite' : 'none',
          }}
        />
      </span>
      {showLabel && c.label}
    </span>
  )
}
