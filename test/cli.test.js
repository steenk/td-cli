import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../src/server.js';

const BIN = fileURLToPath(new URL('../bin/td.js', import.meta.url));
const PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function runCli(args, cwd) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8'
  });
}

function httpGet(port, pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: pathname }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on('error', reject);
  });
}

describe('td-cli', () => {
  const tempDirs = [];

  function makeTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-cli-test-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  it('prints version and help', () => {
    const dir = makeTempDir();
    assert.equal(runCli(['--version'], dir).trim(), PKG.version);
    const help = runCli(['--help'], dir);
    assert.match(help, /Usage: td/);
    assert.match(help, /--server/);
  });

  it('scaffolds a Rollup + Tripledollar v2 project without server.js by default', () => {
    const dir = makeTempDir();
    runCli(['--init', '--name', 'Demo App'], dir);

    assert.equal(fs.existsSync(path.join(dir, 'AGENTS.md')), true);
    assert.equal(fs.existsSync(path.join(dir, 'package.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'rollup.config.js')), true);
    assert.equal(fs.existsSync(path.join(dir, 'dist/index.html')), true);
    assert.equal(fs.existsSync(path.join(dir, 'src/main.js')), true);
    assert.equal(fs.existsSync(path.join(dir, 'src/components/td-demo/index.js')), true);
    assert.equal(fs.existsSync(path.join(dir, 'server.js')), false);

    const expectedAgents = fs.readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
    assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), expectedAgents);

    const demoSrc = fs.readFileSync(path.join(dir, 'src/components/td-demo/index.js'), 'utf8');
    assert.match(demoSrc, /export function createDemo/);
    assert.match(demoSrc, /AbortController/);

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'demo-app');
    assert.equal(pkg.dependencies.tripledollar, '^2.0.0');
  });

  it('scaffolds optional server.js when --server is passed and refuses to overwrite existing files', () => {
    const dir = makeTempDir();
    runCli(['--init', '--server'], dir);
    assert.equal(fs.existsSync(path.join(dir, 'server.js')), true);

    assert.throws(() => runCli(['--init'], dir));
  });

  it('serves static files, reports /status, and blocks directory traversal', async () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Hello</h1>');
    fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1);');

    const server = createStaticServer({ root: dir, port: 0, host: '127.0.0.1', quiet: true });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const idx = await httpGet(port, '/');
      assert.equal(idx.status, 200);
      assert.match(idx.headers['content-type'], /text\/html/);
      assert.equal(idx.body, '<h1>Hello</h1>');

      const js = await httpGet(port, '/app.js');
      assert.equal(js.status, 200);
      assert.match(js.headers['content-type'], /text\/javascript/);

      const status = await httpGet(port, '/status');
      assert.equal(status.status, 200);
      assert.match(status.body, /Running on port/);

      const missing = await httpGet(port, '/does-not-exist');
      assert.equal(missing.status, 404);

      const traversal = await httpGet(port, '/..%2F..%2Fetc%2Fpasswd');
      assert.equal(traversal.status, 403);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('starts, reports status, and kills a detached server via CLI commands', async () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>Served</p>');
    const port = 39481;

    try {
      runCli(['--start', '--port', String(port)], dir);
      const statusOut = runCli(['--status', '--port', String(port)], dir);
      assert.match(statusOut, new RegExp(`Running on port ${port}`));

      const res = await httpGet(port, '/');
      assert.equal(res.status, 200);
      assert.equal(res.body, '<p>Served</p>');
    } finally {
      const killOut = runCli(['--kill', '--port', String(port)], dir);
      assert.match(killOut, /Server is stopped/);
    }
  });

  it('runs optional custom server.js when present and respects --port', async () => {
    const dir = makeTempDir();
    runCli(['--init', '--server', '--name', 'Custom Server App'], dir);
    // Satisfy dist/bundle.js check
    fs.writeFileSync(path.join(dir, 'dist/bundle.js'), 'console.log("ok");');
    const port = 39482;

    try {
      runCli(['--start', '--port', String(port)], dir);
      const statusOut = runCli(['--status', '--port', String(port)], dir);
      assert.match(statusOut, new RegExp(`Running on port ${port}`));

      const res = await httpGet(port, '/');
      assert.equal(res.status, 200);
      assert.match(res.body, /<title>Custom Server App<\/title>/);
    } finally {
      const killOut = runCli(['--kill', '--port', String(port)], dir);
      assert.match(killOut, /Server is stopped/);
    }
  });
});
