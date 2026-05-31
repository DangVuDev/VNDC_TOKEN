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
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-blue-900"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...props}
          className={[
            'block w-full rounded-lg border px-3 py-2 text-sm text-blue-900',
            'placeholder:text-blue-300 bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-colors duration-150',
            error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-blue-200 hover:border-blue-400',
            props.disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '',
            className,
          ].join(' ')}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-blue-400">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
