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

const colorMap: Record<ToastVariant, string> = {
  success: 'bg-emerald-700',
  error: 'bg-red-700',
  info: 'bg-[var(--accent)]',
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
        'flex min-w-[260px] max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg',
        'animate-slide-in',
        colorMap[variant],
      ].join(' ')}
    >
      <span className="mt-1 h-2 w-2 rounded-full bg-white/80" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onRemove}
        className="ml-2 font-bold leading-none opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        x
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
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
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
