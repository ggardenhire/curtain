import { useState, useEffect } from 'react'
import './App.css'


function App() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(false)
  const [links, setLinks] = useState([])
    
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
  useEffect(() => {
    loadMetrics()
    loadLinks()
    const id = setInterval(() => {
      loadMetrics()
      loadLinks()
    }
    , 5000)   // then poll every 5s
    return () => clearInterval(id)
  }, []) 

  if (error && !metrics) return <main className="curtain"><p className="unavailable">Metrics unavailable</p></main>
  if (!metrics) return <main className="curtain"><p>Loading…</p></main>

  return (
    <main className="curtain">
      <h1>curtain</h1>
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
      {links.length > 0 && (
        <nav className="links">
          <h2>Links</h2>
          <ul>
            {links.map(link => (
              <li key={link.label}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                <img className="link-icon" src={link.icon} alt="" />
                <span>{link.label}</span>
              </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  )
}

export default App