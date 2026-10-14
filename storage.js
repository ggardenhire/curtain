import { readdir, lstat, statfs } from 'node:fs/promises'
import path from 'node:path'

// Recursively sum file sizes under `dir`. Does NOT follow symlinks.
async function directorySize(dir) {
  let total = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })   // one syscall, typed entries
  } catch {
    return 0   // unreadable dir → count as 0, never throw (fail closed)
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) {
      continue                                   // SKIP links: no cycles, no escaping the tree
    } else if (entry.isDirectory()) {
      total += await directorySize(full)         // recurse into real subdirs
    } else if (entry.isFile()) {
      try {
        total += (await lstat(full)).size        // lstat = don't follow links
      } catch { /* file vanished mid-walk — skip */ }
    }
  }
  return total
}

const MAX_STORAGE_PATHS = 3

const allStoragePaths = (process.env.STORAGE_PATHS || '')
  .split(',').map(s => s.trim()).filter(Boolean)   // "" → [] safely

if (allStoragePaths.length > MAX_STORAGE_PATHS) {
  console.warn(
    `STORAGE_PATHS: ${allStoragePaths.length} paths provided, only the first ` +
    `${MAX_STORAGE_PATHS} will be shown (the rest fall into "Other").`
  )
}

const STORAGE_PATHS = allStoragePaths.slice(0, MAX_STORAGE_PATHS)   // cap at three

let cache = { ready: false, total: 0, segments: [], updatedAt: null }

async function refreshStorage() {
  try {
    const measured = []
    for (const p of STORAGE_PATHS) {
      const bytes = await directorySize(p)
      measured.push({ label: path.basename(p), bytes })
    }

    const fs = await statfs(process.env.DISK_PATH || '/')
    const total = fs.bsize * fs.blocks
    const free = fs.bsize * fs.bfree
    const used = total - free

    const named = measured.reduce((sum, seg) => sum + seg.bytes, 0)
    const other = Math.max(0, used - named)
    const segments = [...measured, { label: 'Other', bytes: other }, { label: 'Free', bytes: free }]
    cache = { ready: true, total, segments, updatedAt: new Date().toISOString() }
  } catch (err) {
    console.error('storage refresh failed:', err.message)   // keep last good cache
  }
}

function getStorage() { return cache }

export { refreshStorage, getStorage }

