import { useEffect, useMemo, useRef, useState } from 'react'
import { api, apiEnabled } from '../lib/api'

type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }

type Activity = { total: number; days: Day[] }

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

function Heatmap() {
  const [data, setData] = useState<Activity | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!apiEnabled) return
    const controller = new AbortController()
    api<Activity>('/api/github/activity', { signal: controller.signal })
      .then(setData)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  // Start scrolled to the latest weeks when the grid is wider than the screen.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [data])

  // Blank cells pad the first week so every column starts on a Sunday.
  const cells = useMemo(() => {
    if (!data || data.days.length === 0) return []
    const pad = dayOfWeek(data.days[0].date)
    return [...Array<null>(pad).fill(null), ...data.days]
  }, [data])

  if (!data) return null

  return (
    <div className="heatmap-scroll" ref={scroller}>
      <div className="heatmap" role="img" aria-label={`${data.total} commits`}>
        {cells.map((day, i) =>
          day ? (
            <span
              key={day.date}
              className={`cell level-${day.level}`}
              title={`${day.count} on ${formatDate(day.date)}`}
            />
          ) : (
            <span key={`pad-${i}`} className="cell pad" />
          ),
        )}
      </div>
    </div>
  )
}

export default Heatmap
