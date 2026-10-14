// Load the built-in HTTP module
import http from 'node:http';
import getMetrics from './metrics.js';

const PORT = 1939; //Release date for The Wizard of Oz

// Create an HTTP server
const server = http.createServer(async (req, res) => {
  
  try {
    if (req.url === '/' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Pay no attention to the server behind the curtain.\n');
    } else if (req.url === '/api/metrics' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        const data = await getMetrics();
        res.end(JSON.stringify(data));
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found\n');
    }
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Internal Server Error\n');
    console.error('Server error:', error);
  }
});

// Start the server and listen on the specified port
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});