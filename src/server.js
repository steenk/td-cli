import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function isLoopback(remoteAddress) {
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

/**
 * Create a lightweight zero-dependency static HTTP dev server.
 *
 * @param {{ root: string; port?: number; host?: string; quiet?: boolean }} options
 */
export function createStaticServer({ root, port = 3000, host = '127.0.0.1', quiet = false }) {
  const absRoot = path.resolve(root);

  const server = http.createServer((req, res) => {
    const method = req.method || 'GET';
    const rawUrl = req.url || '/';
    const url = new URL(rawUrl, `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Running on port ${port} with document root ${absRoot}\n`);
      return;
    }

    if (pathname === '/exit') {
      if (!isLoopback(req.socket.remoteAddress)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden\n');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Shutting down\n', () => {
        server.close(() => process.exit(0));
      });
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed\n');
      return;
    }

    const relPath = pathname.replace(/^\/+/, '');
    let filePath = path.resolve(absRoot, relPath);

    // Prevent directory traversal outside absRoot
    if (filePath !== absRoot && !filePath.startsWith(absRoot + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden\n');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        fs.stat(filePath, (err2, stats2) => serveFile(err2, stats2, filePath));
      } else {
        serveFile(err, stats, filePath);
      }
    });

    function serveFile(err, stats, target) {
      if (err || !stats || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found\n');
        if (!quiet) console.log(`${method} ${pathname} 404`);
        return;
      }

      const ext = path.extname(target).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache'
      });

      if (!quiet) console.log(`${method} ${pathname} 200`);
      if (method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(target);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('Internal Server Error\n');
      });
      stream.pipe(res);
    }
  });

  return server;
}

// Allow running directly as a standalone / detached child process
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: process.cwd() },
      port: { type: 'string', default: process.env.TD_PORT || '3000' },
      host: { type: 'string', default: process.env.TD_HOST || '127.0.0.1' },
      quiet: { type: 'boolean', default: false }
    }
  });

  const port = Number.parseInt(values.port, 10) || 3000;
  const host = values.host || '127.0.0.1';
  const root = path.resolve(values.root);
  const server = createStaticServer({ root, port, host, quiet: values.quiet });

  server.listen(port, host, () => {
    if (!values.quiet) {
      console.log(`Serving ${root} on http://${host}:${port} (PID ${process.pid})`);
    }
  });
}
