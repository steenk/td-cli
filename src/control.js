import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER_SCRIPT = fileURLToPath(new URL('./server.js', import.meta.url));

/**
 * Request /exit on a locally running server (no-op if none running).
 *
 * @param {number} port
 * @returns {Promise<boolean>} true if a server responded
 */
export function killServer(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/exit', method: 'GET', timeout: 1000 },
      (res) => {
        res.resume();
        res.on('end', () => resolve(true));
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Query /status on a locally running server.
 *
 * @param {number} port
 * @returns {Promise<string | null>}
 */
export function getServerStatus(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/status', method: 'GET', timeout: 1000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body.trim()));
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * Wait until the server responds to /status (up to timeoutMs).
 */
async function waitForServer(port, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getServerStatus(port);
    if (status) return status;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/**
 * Open a URL safely in the user's default browser without shell interpolation.
 *
 * @param {number} port
 * @param {string} [pathname='/']
 */
export function openBrowser(port, pathname = '/') {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = `http://127.0.0.1:${port}${cleanPath}`;

  let cmd;
  let args;
  if (process.platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  execFile(cmd, args, (err) => {
    if (err) {
      console.error('Could not open browser:', err.message);
    }
  });
}

/**
 * Start either the project's custom server.js (if present) or the built-in static server.
 *
 * @param {{ cwd?: string; port: number; isPublic?: boolean; open?: boolean; openPath?: string }} opts
 */
export async function startServer({ cwd = process.cwd(), port, isPublic = false, open = false, openPath = '/' }) {
  // Restart cleanly if a server is already running on this port
  await killServer(port);

  const host = isPublic ? '0.0.0.0' : '127.0.0.1';
  const customServer = path.join(cwd, 'server.js');
  const distDir = path.join(cwd, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const distBundle = path.join(distDir, 'bundle.js');

  if (fs.existsSync(distIndex) && fs.existsSync(path.join(cwd, 'rollup.config.js')) && !fs.existsSync(distBundle)) {
    console.error('\nRun "npm run build" first to generate "dist/bundle.js".\n');
    process.exitCode = 1;
    return null;
  }

  const useCustom = fs.existsSync(customServer);
  const root = fs.existsSync(distIndex) ? distDir : cwd;
  const spawnArgs = useCustom
    ? [customServer]
    : [SERVER_SCRIPT, '--root', root, '--port', String(port), '--host', host, '--quiet'];

  const env = {
    ...process.env,
    TD_PORT: String(port),
    TD_HOST: host
  };

  const child = spawn(process.execPath, spawnArgs, {
    cwd,
    detached: true,
    stdio: 'ignore',
    env
  });
  child.unref();

  const status = await waitForServer(port);
  if (!status) {
    console.error(`Failed to start HTTP server on http://${host}:${port}.`);
    process.exitCode = 1;
    return null;
  }

  console.log(`\nHTTP server started (PID ${child.pid}) at http://${host}:${port}`);
  console.log(`Document root: ${useCustom ? 'custom server.js' : root}`);
  console.log('Use "td --kill" to stop it.\n');

  if (open) {
    openBrowser(port, openPath);
  }

  return child;
}
