const MAX_LINKS = 12

function isValidHttpUrl(value) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

function isValidIcon(value) {
  if (!value) return false
  if (value.startsWith('/')) return true   // local file served from public/ (serveStatic is traversal-hardened)
  return isValidHttpUrl(value)             // or an external http(s) image
}

function getLinks() {
  const links = []
  for (let i = 1; i <= MAX_LINKS; i++) {
    const label = process.env[`LINK_${i}_LABEL`]
    const url   = process.env[`LINK_${i}_URL`]
    const icon  = process.env[`LINK_${i}_ICON`]
    if (label && isValidHttpUrl(url)) {
      links.push({ label, url, icon: isValidIcon(icon) ? icon : null })   // icon optional
    }
  }
  return links
}

export default getLinks
export { isValidHttpUrl }