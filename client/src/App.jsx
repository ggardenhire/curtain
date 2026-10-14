import { useState, useEffect } from 'react'

function App() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetch('/api/metrics')
      .then(response => response.json())
      .then(data => setMetrics(data))
      .catch(error => console.error('Error fetching metrics:', error));
  }, [])   // <- empty deps = run once on mount

  if (!metrics) return <p>Loading…</p>

  return (
    <div>
      <p>CPU Load (1m): {metrics.cpuLoad1m}</p>
      <p>Memory Usage: {metrics.memory.percent}%</p>
      <p>Uptime (hours): {metrics.uptimeHours}</p>
    </div>
  )
}

export default App