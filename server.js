// Load the built-in HTTP module
import http from 'node:http';
import getMetrics from './metrics.js';
import getLinks from './links.js';
import { getStorage, refreshStorage } from './storage.js';
import getConfig from './config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, 'client', 'dist');

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.png':  'image/png',
};
const PORT = 1939; //Release date for The Wizard of Oz

// Security headers applied to EVERY response (defense in depth for a public, no-auth surface)
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');       // block MIME sniffing
  res.setHeader('X-Frame-Options', 'DENY');                 // anti-clickjacking (legacy header)
  res.setHeader('Referrer-Policy', 'no-referrer');          // don't leak our URL to link targets
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",   // React inline styles (pie gradient + swatches)
    "img-src 'self' https: data:",        // self-hosted logos + optional external https icons
    "connect-src 'self'",                 // the /api/* fetches
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",             // modern anti-clickjacking
  ].join('; '));
}

// Create an HTTP server
const server = http.createServer(async (req, res) => {

  try {
    setSecurityHeaders(res);
    if (req.url === '/api/metrics' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        const data = await getMetrics();
        res.end(JSON.stringify(data));
    } else if (req.url === '/api/links' && req.method === 'GET') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(getLinks()))
    } else if (req.url === '/api/config' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(getConfig()));
    } else if (req.url === '/api/storage' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(getStorage()));
    } else if (req.url.startsWith('/api/')) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'not found' }));
    } else if (req.method === 'GET') {
        await serveStatic(req, res);   
    } else {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Method Not Allowed\n');
    }
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Internal Server Error\n');
    console.error('Server error:', error);
  }
});

async function serveStatic(req, res) {

    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath === '/') 
        urlPath = '/index.html';

    const filePath = path.resolve(DIST_DIR, '.' + urlPath);

    if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }
    
    try {
      const data = await readFile(filePath);
      const type = MIME[path.extname(filePath)] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', type);
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found\n');   // fail closed — no error details
    }
}

// Start the server and listen on the specified port
server.listen(PORT, () => {
    refreshStorage();
    setInterval(refreshStorage, 10 * 60 * 1000)
    console.log(`Server running at http://localhost:${PORT}/`);
});