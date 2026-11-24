#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { initProject } from '../src/init.js';
import { startServer, killServer, getServerStatus, openBrowser } from '../src/control.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function printHelp() {
  console.log(`td-cli v${pkg.version} - CLI & dev server for Tripledollar projects

Usage: td [options] [path]

Options:
  -i, --init           Create initial project structure (Rollup + Tripledollar v2)
  -n, --name <name>    Project name (used with --init)
      --server         Also generate an optional custom server.js (used with --init)
  -s, --start          Start the HTTP dev server
  -k, --kill           Stop the running server on the given port
  -r, --status         Check if the server is running
  -o, --open           Open the browser (optionally pass a subpath)
  -p, --port <port>    Server port (default: $TD_PORT or 3000)
  -q, --public         Listen on 0.0.0.0 instead of 127.0.0.1
  -v, --version        Show td-cli version
  -h, --help           Show this help text`);
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      init: { type: 'boolean', short: 'i', default: false },
      name: { type: 'string', short: 'n' },
      server: { type: 'boolean', default: false },
      start: { type: 'boolean', short: 's', default: false },
      kill: { type: 'boolean', short: 'k', default: false },
      status: { type: 'boolean', short: 'r', default: false },
      open: { type: 'boolean', short: 'o', default: false },
      port: { type: 'string', short: 'p' },
      public: { type: 'boolean', short: 'q', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  });
} catch (err) {
  console.error(err.message);
  printHelp();
  process.exit(1);
}

const { values: opt, positionals } = parsed;
const port = Number.parseInt(opt.port || process.env.TD_PORT || '3000', 10);

if (Number.isNaN(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port: ${opt.port}`);
  process.exit(1);
}

if (opt.help) {
  printHelp();
} else if (opt.version) {
  console.log(pkg.version);
} else if (opt.init) {
  const result = initProject({
    cwd: process.cwd(),
    name: opt.name || 'Tripledollar',
    includeServer: opt.server
  });
  if (result.skipped) {
    process.exitCode = 1;
  }
} else if (opt.start) {
  await startServer({
    cwd: process.cwd(),
    port,
    isPublic: opt.public,
    open: opt.open,
    openPath: positionals[0] || '/'
  });
} else if (opt.open) {
  openBrowser(port, positionals[0] || '/');
} else if (opt.kill) {
  const stopped = await killServer(port);
  console.log(stopped ? 'Server is stopped.' : 'No server running on port ' + port + '.');
} else if (opt.status) {
  const status = await getServerStatus(port);
  console.log(status ? `td: ${status}` : 'No server started.');
} else {
  printHelp();
}
