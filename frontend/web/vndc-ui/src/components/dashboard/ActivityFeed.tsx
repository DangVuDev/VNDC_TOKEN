import { Card, CardHeader, CardTitle } from '../ui/Card'

export type ActivityEntry = {
  id: string
  action: string
  detail?: string
  time: Date
  ok: boolean
}

interface ActivityFeedProps {
  entries: ActivityEntry[]
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      {entries.length === 0 ? (
        <p className="text-sm text-blue-300 text-center py-4">No activity yet</p>
      ) : (
        <div className="divide-y divide-blue-50">
          {entries.slice(0, 10).map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-2.5">
              <div
                className={[
                  'mt-0.5 w-2 h-2 rounded-full flex-shrink-0',
                  e.ok ? 'bg-emerald-400' : 'bg-red-400',
                ].join(' ')}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-900 font-medium">{e.action}</p>
                {e.detail && <p className="text-xs text-blue-400 truncate">{e.detail}</p>}
              </div>
              <time className="text-xs text-blue-300 flex-shrink-0">
                {e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
