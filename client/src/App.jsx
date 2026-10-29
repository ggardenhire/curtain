import { useState, useEffect } from 'react'
import './App.css'


function App() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(false)
  const [links, setLinks] = useState([])
  const [storage, setStorage] = useState(null)
  const [latest, setLatest] = useState(null)
  const [config, setConfig] = useState({ serverName: 'curtain' })
  const STORAGE_COLORS = [
    '#7ace94', // emerald      (first used category)
    '#e0b63e', // yellow brick (gold)
    '#c76b6b', // ruby (muted)
    '#4f8c63', // deep green
    '#20262e', // slate — reads as "empty" for Free
  ]


  function formatGB(bytes) {
    return (bytes / 1024 ** 3).toFixed(2) + ' GB'
  }

    
  async function loadMetrics() {
    try {
      const res = await fetch('/api/metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)   // <- your lines 7-9 live HERE
      setMetrics(await res.json())
      setError(false)
    } catch (err) {
      console.error('metrics fetch failed:', err.message)
      setError(true)
    }
  }

  async function loadLinks() {
    try {
      const res = await fetch('/api/links')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setLinks(await res.json())
    } catch (err) {
      console.error('links fetch failed:', err.message)
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConfig(await res.json())
    } catch (err) {
      console.error('config fetch failed:', err.message)  // keep the default
    }
  }
  
  async function loadStorage() {
    try {
      const res = await fetch('/api/storage')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStorage(await res.json())
    } catch (err) {
      console.error('storage fetch failed:', err.message)
    }
  }

  async function loadLatest() {
    try {
      const res = await fetch('/api/latest')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setLatest(await res.json())
    } catch (err) {
      console.error('latest fetch failed:', err.message)
    }
  }

  // a point on a circle; angle 0 = top of the pie, going clockwise
  function polar(cx, cy, r, angleDeg) {
    const a = ((angleDeg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  // "Free" is always black; everything else draws from the palette
  function sliceColor(label, i) {
    return label === 'Free' ? '#20262e' : STORAGE_COLORS[i % STORAGE_COLORS.length]
  }

  // turn segments into SVG donut (annular) paths + where to place each label
  function buildSlices(segments, total) {
    const cx = 50, cy = 50, r = 48, ir = 18   // outer radius + inner (hollow) radius
    let acc = 0
    return segments.map((seg, i) => {
      const startAngle = (acc / total) * 360
      acc += seg.bytes
      const endAngle = (acc / total) * 360
      const [ox1, oy1] = polar(cx, cy, r, startAngle)
      const [ox2, oy2] = polar(cx, cy, r, endAngle)
      const [ix2, iy2] = polar(cx, cy, ir, endAngle)
      const [ix1, iy1] = polar(cx, cy, ir, startAngle)
      const largeArc = endAngle - startAngle > 180 ? 1 : 0
      const d = `M ${ox1} ${oy1} A ${r} ${r} 0 ${largeArc} 1 ${ox2} ${oy2} ` +
                `L ${ix2} ${iy2} A ${ir} ${ir} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
      const [lx, ly] = polar(cx, cy, (r + ir) / 2, (startAngle + endAngle) / 2)  // middle of the ring
      return {
        d, lx, ly,
        label: seg.label,
        color: sliceColor(seg.label, i),
        showLabel: (endAngle - startAngle) / 360 >= 0.08,   // only label if the wedge has room
      }
    })
  }
    
  useEffect(() => {
    loadMetrics()
    loadLinks()
    loadConfig()
    loadStorage()
    loadLatest()
    document.title = config.serverName
    const id = setInterval(() => {
      loadMetrics()
      loadLinks()
      loadConfig()
      loadStorage()
      loadLatest()
    }
    , 5000)   // then poll every 5s
    return () => clearInterval(id)
  }, [config.serverName]) 

  if (error && !metrics) return <main className="curtain"><p className="unavailable">Metrics unavailable</p></main>
  if (!metrics) return <main className="curtain"><p>Loading…</p></main>

  return (
    <main className="curtain">
      <h1>{config.serverName}</h1>
      {error && <p className="unavailable">⚠ metrics may be stale</p>}
      <div className="grid">
        {metrics.disk
          ? <div className="stat"><span className="label">Disk</span><span className="value">{metrics.disk.percent}%</span></div>
          : <div className="stat"><span className="label">Disk</span><span className="value unavailable">unavailable</span></div>}
        {metrics.cpuLoad1m
          ? <div className="stat"><span className="label">CPU Load (1m)</span><span className="value">{metrics.cpuLoad1m}</span></div>
          : <div className="stat"><span className="label">CPU Load (1m)</span><span className="value unavailable">unavailable</span></div>}
        {metrics.memory
          ? <div className="stat"><span className="label">Memory</span><span className="value">{metrics.memory.percent}%</span></div>
          : <div className="stat"><span className="label">Memory</span><span className="value unavailable">unavailable</span></div>}
        {metrics.uptimeHours
          ? <div className="stat"><span className="label">Uptime (hours)</span><span className="value">{metrics.uptimeHours}</span></div>
          : <div className="stat"><span className="label">Uptime (hours)</span><span className="value unavailable">unavailable</span></div>}
      </div>
      <div className="lower">
      {storage?.ready && storage.total > 0 && (
        <section className="storage">
          <h2>Storage</h2>
          <div className="storage-body">
            <svg className="pie" viewBox="0 0 100 100" role="img" aria-label="Storage usage breakdown">
              {buildSlices(storage.segments, storage.total).map(s => (
                <g key={s.label}>
                  <path d={s.d} fill={s.color} stroke="#0b0d10" strokeWidth="0.75" strokeLinejoin="round" />
                  {s.showLabel && (
                    <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="central" className="pie-label">
                      {s.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            <ul className="legend">
              {storage.segments.map((seg, i) => (
                <li key={seg.label}>
                  <span className="swatch" style={{ background: sliceColor(seg.label, i) }} />
                  {seg.label}: {formatGB(seg.bytes)} ({((seg.bytes / storage.total) * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {links.length > 0 && (
        <nav className="links">
          <h2>Links</h2>
          <ul>
            {links.map(link => (
              <li key={link.label}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.icon && <img className="link-icon" src={link.icon} alt="" />}
                  <span>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      </div>
      {latest?.ready && latest.movies?.length > 0 && (
        <section className="latest">
          <h2>Recently Added</h2>
          <div className="latest-grid">
            {latest.movies.map((m, i) => (
              <figure className="latest-item" key={m.title}>
                {m.hasPoster && (
                  <img key={m.title} className="poster" src={`/api/poster/${i}`} alt={m.title} />
                )}
                <figcaption>{m.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {config.contactUrl && (
        <footer className="admin">
          <a href={config.contactUrl} target="_blank" rel="noopener noreferrer">Site Admin Contact Page</a>
        </footer>
)}

    </main>
  )
}

export default App