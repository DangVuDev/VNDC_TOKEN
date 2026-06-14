type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-[var(--success-soft)] text-emerald-800 ring-1 ring-emerald-200',
  warning: 'bg-[var(--warning-soft)] text-amber-800 ring-1 ring-amber-200',
  danger: 'bg-[var(--danger-soft)] text-red-800 ring-1 ring-red-200',
  info: 'bg-[var(--accent-tint)] text-[var(--accent-strong)] ring-1 ring-blue-200',
  neutral: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',
}

const dotClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
}

export function Badge({ variant = 'neutral', children, dot = false }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variantClasses[variant],
      ].join(' ')}
    >
      {dot && (
        <span className={['h-1.5 w-1.5 rounded-full', dotClasses[variant]].join(' ')} />
      )}
      {children}
    </span>
  )
}
