import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] focus:ring-[var(--accent)]',
  secondary:
    'border border-[var(--border)] bg-white text-[var(--accent-strong)] hover:bg-[var(--accent-tint)] focus:ring-[var(--accent)]',
  danger:
    'border-transparent bg-[var(--danger)] text-white hover:bg-red-700 focus:ring-[var(--danger)]',
  ghost:
    'border-transparent bg-transparent text-[var(--accent-strong)] hover:bg-[var(--accent-tint)] focus:ring-[var(--accent)]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}
