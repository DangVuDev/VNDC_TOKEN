import { useEffect, useState } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastMessage {
  id: number
  message: string
  variant: ToastVariant
}

let toastId = 0
type ToastListener = (msg: ToastMessage) => void
const listeners: ToastListener[] = []

export function toast(message: string, variant: ToastVariant = 'info') {
  const msg: ToastMessage = { id: ++toastId, message, variant }
  listeners.forEach((fn) => fn(msg))
}
toast.success = (msg: string) => toast(msg, 'success')
toast.error = (msg: string) => toast(msg, 'error')

const iconMap: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

const colorMap: Record<ToastVariant, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
}

function ToastItem({
  message,
  variant,
  onRemove,
}: {
  message: string
  variant: ToastVariant
  onRemove: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onRemove, 3500)
    return () => clearTimeout(t)
  }, [onRemove])

  return (
    <div
      className={[
        'flex items-start gap-3 text-white text-sm px-4 py-3 rounded-xl shadow-lg',
        'min-w-[260px] max-w-sm animate-slide-in',
        colorMap[variant],
      ].join(' ')}
    >
      <span className="font-bold mt-0.5">{iconMap[variant]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={onRemove}
        className="opacity-70 hover:opacity-100 font-bold leading-none ml-2"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handler: ToastListener = (msg) => {
      setToasts((prev) => [...prev, msg])
    }
    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [])

  function remove(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          message={t.message}
          variant={t.variant}
          onRemove={() => remove(t.id)}
        />
      ))}
    </div>
  )
}
