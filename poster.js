import { readdir, lstat, readFile } from 'node:fs/promises'
import path from 'node:path'


const MOVIES_PATH = process.env.MOVIES_PATH || null
const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv'])
const MAX_MOVIES = 3

// One entry per movie (server-side): { title, isDirectory, dir, hasPoster, bytes, contentType, source }
let cache = { ready: false, movies: [] }

async function readMoviePath() {
    try {
        return await readdir(MOVIES_PATH, { withFileTypes: true })
    } catch {
        return []
    }
}

// The MAX_MOVIES most-recently-modified movies (folders or bare video files),
// newest first. Returns [{ title, isDirectory, dir }].
async function findLatestMovies() {
    const entries = await readMoviePath()
    const candidates = []
    for (const entry of entries) {
        const full = path.join(MOVIES_PATH, entry.name)
        const isVideoFile = entry.isFile() && VIDEO_EXT.has(path.extname(entry.name).toLowerCase())
        if (entry.isSymbolicLink()) continue                 // SKIP links: no escaping the mount
        if (!isVideoFile && !entry.isDirectory()) continue   // skip junk/sidecars at the root
        try {
            const stats = await lstat(full)
            const isDirectory = entry.isDirectory()
            const title = isDirectory ? entry.name : path.basename(entry.name, path.extname(entry.name))
            candidates.push({ title, isDirectory, dir: full, mtimeMs: stats.mtimeMs })
        } catch { /* path vanished mid-walk — skip */ }
    }
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)   // newest first
    return candidates.slice(0, MAX_MOVIES)
}

// ---------------------------------------------------------------------------
// Poster resolution — SECURITY-CRITICAL. This code reads files off the movies
// mount and (optionally) fetches images from the internet, then serves those
// bytes to the public. Every path here fails closed.
// ---------------------------------------------------------------------------

const POSTER_NAMES = ['poster.jpg', 'poster.png', 'folder.jpg', 'cover.jpg']
const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const MAX_POSTER_BYTES = 10 * 1024 * 1024        // 10 MB hard cap — never buffer more than this
const TMDB_API_KEY = process.env.TMDB_API_KEY || null
const TMDB_TIMEOUT_MS = 5000

// Read ONE on-disk image safely. Returns { bytes, contentType } or null.
// Defenses: path stays inside the movies mount, extension allowlist, no symlink
// following, size cap checked before the read.
async function readImageFile(filePath) {
  const root = path.resolve(MOVIES_PATH)
  const resolved = path.resolve(filePath)
  // containment: must stay within the read-only movies mount (same idea as serveStatic)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null
  const contentType = IMAGE_TYPES[path.extname(resolved).toLowerCase()]
  if (!contentType) return null                                  // extension allowlist
  try {
    const stats = await lstat(resolved)                          // lstat: do NOT follow symlinks
    if (!stats.isFile()) return null                             // symlink/dir/device → reject
    if (stats.size > MAX_POSTER_BYTES) return null               // cap before reading into memory
    return { bytes: await readFile(resolved), contentType }
  } catch {
    return null                                                  // fail closed
  }
}

// Look for a poster next to ONE movie.
//   folder  → poster.jpg / folder.jpg / cover.jpg INSIDE the folder
//   bare file → sidecar image named like the movie (e.g. "The Matrix (1999).jpg")
async function findLocalPoster(movie) {
  const candidates = movie.isDirectory
    ? POSTER_NAMES.map(n => path.join(movie.dir, n))
    : Object.keys(IMAGE_TYPES).map(ext => path.join(MOVIES_PATH, movie.title + ext))
  for (const candidate of candidates) {
    const img = await readImageFile(candidate)
    if (img) return { ...img, source: 'local' }
  }
  return null
}

// A time-bounded fetch. AbortController guarantees we never hang on a slow host;
// redirect:'error' blocks redirect-based SSRF (TMDB never legitimately redirects us).
async function boundedFetch(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TMDB_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: 'error' })
  } finally {
    clearTimeout(timer)
  }
}

// TMDB fallback. Returns { bytes, contentType, source:'tmdb' } or null.
// The API key is used ONLY in the server→TMDB request — never logged, never cached,
// never returned to the browser. Hosts are hardcoded (no SSRF). Fails closed.
async function fetchTmdbPoster(title) {
  if (!TMDB_API_KEY || !title) return null

  // "The Matrix (1999)" → query "The Matrix" + year "1999"
  const yearMatch = title.match(/\((\d{4})\)\s*$/)
  const year = yearMatch ? yearMatch[1] : ''
  const query = title.replace(/\((\d{4})\)\s*$/, '').replace(/[._]+/g, ' ').trim()
  if (!query) return null

  try {
    const searchUrl = new URL('https://api.themoviedb.org/3/search/movie')
    searchUrl.searchParams.set('api_key', TMDB_API_KEY)
    searchUrl.searchParams.set('query', query)
    if (year) searchUrl.searchParams.set('year', year)

    const searchRes = await boundedFetch(searchUrl)
    if (!searchRes.ok) return null
    const data = await searchRes.json()
    const posterPath = data?.results?.[0]?.poster_path
    // TMDB paths look like "/abc123.jpg"; reject anything that isn't that exact shape
    if (typeof posterPath !== 'string' || !/^\/[\w-]+\.(jpg|png)$/i.test(posterPath)) return null

    // Proxy the image ourselves so visitors' browsers never contact TMDB.
    const imgRes = await boundedFetch(`https://image.tmdb.org/t/p/w500${posterPath}`)
    if (!imgRes.ok) return null
    const contentType = imgRes.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null           // must actually be an image
    const declared = Number(imgRes.headers.get('content-length'))
    if (declared && declared > MAX_POSTER_BYTES) return null      // reject oversized up front
    const bytes = Buffer.from(await imgRes.arrayBuffer())
    if (bytes.length > MAX_POSTER_BYTES) return null              // and after, in case the header lied
    return { bytes, contentType, source: 'tmdb' }
  } catch {
    return null                                                  // timeout / network / bad data → no poster
  }
}

// Resolve a poster for ONE movie: local file first, TMDB fallback second.
async function resolvePoster(movie) {
  return (await findLocalPoster(movie)) || (await fetchTmdbPoster(movie.title))
}

async function refreshPoster() {
  try {
    const latest = await findLatestMovies()
    const movies = []
    for (const m of latest) {
      const poster = await resolvePoster(m)
      movies.push({
        title: m.title,
        hasPoster: !!poster,
        bytes: poster ? poster.bytes : null,
        contentType: poster ? poster.contentType : null,
        source: poster ? poster.source : null,
      })
    }
    cache = { ready: true, movies }   // atomic swap — last-good stays until a full refresh completes
  } catch (err) {
    console.error('poster refresh failed:', err.message)   // keep last good cache
  }
}

// Public text metadata — curated projection, NEVER the raw cache (no paths, no bytes).
function getLatest() {
  return {
    ready: cache.ready,
    movies: cache.movies.map(m => ({ title: m.title, hasPoster: m.hasPoster })),
  }
}

// Raw image bytes for the /api/poster/<index> endpoint (server-side only).
// Returns null for any out-of-range or poster-less index (fail closed → 404).
function getPoster(index) {
  const movie = cache.movies[index]
  if (!movie || !movie.hasPoster || !movie.bytes) return null
  return { bytes: movie.bytes, contentType: movie.contentType }
}

export { refreshPoster, getLatest, getPoster }
