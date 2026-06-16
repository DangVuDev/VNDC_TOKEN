import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--ink)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...props}
          className={[
            'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--ink)]',
            'placeholder:text-slate-400',
            'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
            'transition-colors duration-150',
            error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-[var(--border)] hover:border-blue-300',
            props.disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : '',
            className,
          ].join(' ')}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--ink-subtle)]">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
