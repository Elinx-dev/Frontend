const BASE = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function DashboardIcon() {
  return (
    <svg {...BASE}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

export function PropertyIcon() {
  return (
    <svg {...BASE}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M10 21v-6h4v6" />
    </svg>
  )
}

export function TransferIcon() {
  return (
    <svg {...BASE}>
      <path d="M3 8h14l-3-3" />
      <path d="M21 16H7l3 3" />
    </svg>
  )
}

export function QueueIcon() {
  return (
    <svg {...BASE}>
      <path d="M9 6h12" />
      <path d="M9 12h12" />
      <path d="M9 18h12" />
      <path d="m3 6 1.5 1.5L7 5" />
      <path d="m3 12 1.5 1.5L7 11" />
      <path d="m3 18 1.5 1.5L7 17" />
    </svg>
  )
}

export function ListIcon() {
  return (
    <svg {...BASE}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  )
}

export function AuditIcon() {
  return (
    <svg {...BASE}>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v6h6" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </svg>
  )
}

export function AdminIcon() {
  return (
    <svg {...BASE}>
      <path d="M12 3 4 6v6c0 4.5 3.2 8.3 8 9 4.8-.7 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function SignOutIcon() {
  return (
    <svg {...BASE} width={16} height={16}>
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
    </svg>
  )
}

export function UsersIcon() {
  return (
    <svg {...BASE}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18.5 14.5a6.5 6.5 0 0 1 3 5.5" />
    </svg>
  )
}

export function ModulesIcon() {
  return (
    <svg {...BASE}>
      <path d="M12 2.5 3 7l9 4.5L21 7l-9-4.5Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5 9-4.5" />
    </svg>
  )
}

export function FlagIcon() {
  return (
    <svg {...BASE}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  )
}

export function WorkflowIcon() {
  return (
    <svg {...BASE}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v4a2 2 0 0 0 2 2h7" />
      <path d="m12 12 3 3-3 3" />
    </svg>
  )
}
