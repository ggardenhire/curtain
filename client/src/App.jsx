import { useState, useEffect } from 'react'
import './App.css'


function App() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(false)
  const [links, setLinks] = useState([])
  const [storage, setStorage] = useState(null)
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

  function buildPie(segments, total) {
    let acc = 0
    const stops = segments.map((seg, i) => {
      const start = (acc / total) * 100
      acc += seg.bytes
      const end = (acc / total) * 100
      return `${STORAGE_COLORS[i % STORAGE_COLORS.length]} ${start}% ${end}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }
    
  useEffect(() => {
    loadMetrics()
    loadLinks()
    loadConfig()
    loadStorage()
    document.title = config.serverName
    const id = setInterval(() => {
      loadMetrics()
      loadLinks()
      loadConfig()
      loadStorage()
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
            <div className="pie" style={{ background: buildPie(storage.segments, storage.total) }} />
            <ul className="legend">
              {storage.segments.map((seg, i) => (
                <li key={seg.label}>
                  <span className="swatch" style={{ background: STORAGE_COLORS[i % STORAGE_COLORS.length] }} />
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
      {config.contactUrl && (
        <footer className="admin">
          <a href={config.contactUrl} target="_blank" rel="noopener noreferrer">Site Admin Contact Page</a>
        </footer>
)}

    </main>
  )
}

export default App