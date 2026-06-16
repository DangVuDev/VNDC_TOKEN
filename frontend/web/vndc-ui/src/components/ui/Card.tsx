import { type ReactNode, type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        'rounded-2xl border border-[var(--border-soft)] bg-white shadow-sm',
        paddingClasses[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={['mb-4 flex items-center justify-between', className].join(' ')}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={['text-base font-semibold text-[var(--ink)]', className].join(' ')}>
      {children}
    </h3>
  )
}
