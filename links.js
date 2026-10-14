const SERVICES = [
  { label: 'Plex',     envVar: 'PLEX_URL',     icon: '/logos/plex.png' },
  { label: 'Jellyfin', envVar: 'JELLYFIN_URL', icon: '/logos/jellyfin.png' },
  { label: 'Seerr',    envVar: 'SEERR_URL',    icon: '/logos/seerr.png' },
]


function getLinks() {
  return SERVICES
    .map(s => ({ label: s.label, url: process.env[s.envVar], icon: s.icon }))
    .filter(s => isValidHttpUrl(s.url))   // drops empty AND unsafe URLs
}

function isValidHttpUrl(value) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'   // only http(s)
  } catch {
    return false        // not a parseable URL
  }
}

export default getLinks
export { isValidHttpUrl }
