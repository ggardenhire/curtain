import os from 'node:os';
import { statfs } from 'node:fs/promises'

async function getMetrics() {
    const loadavg = Math.round(os.loadavg()[0] * 100) / 100;
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    const uptime = Math.round(os.uptime()/3600);

    const DISK_PATH = '/'

    const memoryStats = {
        usedGB: Math.round((totalmem - freemem) / 1024**3 * 10) / 10,
        totalGB: Math.round(totalmem / 1024**3 * 10) / 10,
        freeGB: Math.round(freemem / 1024**3 * 10) / 10,
        percent: Math.round((totalmem - freemem) / totalmem * 100)
    }

    const diskStats = await getDiskUsage(DISK_PATH);
  
    return { cpuLoad1m: loadavg, memory: memoryStats, uptimeHours: uptime, disk: diskStats };
}

async function getDiskUsage(path) {
  try {
    const stats = await statfs(path)
    const totalBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bfree;
    const usedBytes = totalBytes - freeBytes;
    const usedGB = Math.round(usedBytes / 1024**3 * 10) / 10;
    const totalGB = Math.round(totalBytes / 1024**3 * 10) / 10;
    const percent = Math.round(usedBytes / totalBytes * 100);
    return { usedGB, totalGB, percent }; 
  } catch (err) {
    console.error('disk read failed:', err.message)  // logged server-side only
    return null                                       // fail closed
  }
}


export default getMetrics;