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

function readStoragePaths() {
  const paths = []
  for (let i = 1; i <= MAX_STORAGE_PATHS; i++) {
    const name = process.env[`STORAGE_${i}_NAME`]
    const dir  = process.env[`STORAGE_${i}_PATH`]
    if (name && dir) paths.push({ name, dir })      // need both
  }
  if (process.env[`STORAGE_${MAX_STORAGE_PATHS + 1}_PATH`]) {
    console.warn(`Only ${MAX_STORAGE_PATHS} storage paths are shown; extras fold into "Other".`)
  }
  return paths
}

const STORAGE_PATHS = readStoragePaths()

let cache = { ready: false, total: 0, segments: [], updatedAt: null }

async function refreshStorage() {
  try {
    const measured = []
    for (const { name, dir } of STORAGE_PATHS) {
      const bytes = await directorySize(dir)
      measured.push({ label: name, bytes })
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

