export function indexHtml(name) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${name}</title>
    <script src="bundle.js" defer></script>
  </head>
  <body></body>
</html>
`;
}

export function packageJson(name) {
  const pkgName =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tripledollar-app';

  return (
    JSON.stringify(
      {
        name: pkgName,
        version: '0.1.0',
        type: 'module',
        description: '',
        main: 'dist/bundle.js',
        scripts: {
          build: 'rollup -c',
          watch: 'rollup -c -w',
          start: 'td -s -o',
          stop: 'td -k'
        },
        dependencies: {
          tripledollar: '^2.0.0'
        },
        devDependencies: {
          '@rollup/plugin-node-resolve': '^16.0.0',
          postcss: '^8.5.0',
          rollup: '^4.0.0',
          'rollup-plugin-postcss': '^4.0.0'
        },
        license: 'MIT'
      },
      null,
      2
    ) + '\n'
  );
}

export function rollupConfig() {
  return `import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    resolve(),
    postcss({
      plugins: []
    })
  ]
};
`;
}

export function mainJs(name) {
  return `import $$$ from 'tripledollar';
import './main.css';
import demo from './components/td-demo/index.js';

$$$.appendToDoc([
  'div.center',
  ['h1.tripledollar', ${JSON.stringify(name)}],
  ['p.version', 'Tripledollar v', $$$.version],
  demo()
]).then(() => {
  demo.add('Build fast, compact web applications with just JavaScript.');
});
`;
}

export function mainCss() {
  return `/* main.css */
body {
  padding: 30px;
  background-color: #2b2d30;
  color: gainsboro;
  font-family: system-ui, -apple-system, sans-serif;
}

.center {
  margin-inline: auto;
  max-width: 850px;
}

.tripledollar {
  text-shadow: 1pt 1pt 5pt #111;
  color: goldenrod;
  margin-bottom: 4px;
}

.version {
  margin-top: 4px;
  margin-bottom: 24px;
  opacity: 0.85;
}
`;
}

export function demoComponentJs() {
  return `import $$$ from 'tripledollar';
import './style.css';

function render() {
  return $$$([
    'div.td-demo',
    ['h2', 'Just DOM scripting'],
    [
      'pre',
\`import $$$ from 'tripledollar';

await $$$.appendToDoc(['div',
  ['h1', 'Tripledollar'],
  ['p', 'Version ', $$$.version]
]);\`
    ],
    $$$('button.td-btn', { type: 'button' }, 'Click me').evt(
      'click',
      (e) => {
        e.currentTarget.textContent = 'Clicked!';
      },
      { once: true }
    )
  ]);
}

render.add = function (note) {
  const demo = document.querySelector('.td-demo');
  if (demo) {
    $$$(demo).ins(['p.note', note]);
  }
};

export default render;
`;
}

export function demoComponentCss() {
  return `.td-demo {
  border: 1px solid darkgoldenrod;
  border-radius: 6px;
  padding: 16px;

  & pre {
    color: chartreuse;
    padding: 12px;
    background-color: #111;
    border-radius: 4px;
    overflow-x: auto;
  }

  & .td-btn {
    margin-top: 8px;
    padding: 6px 14px;
    border: 1px solid darkgoldenrod;
    border-radius: 4px;
    background: #1f2023;
    color: gold;
    cursor: pointer;
  }
}
`;
}

export function optionalServerJs() {
  return `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number.parseInt(process.env.TD_PORT || '3000', 10);
const HOST = process.env.TD_HOST || '127.0.0.1';
const ROOT = path.resolve(process.cwd(), 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function isLoopback(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', \`http://\${HOST}:\${PORT}\`);
  const pathname = decodeURIComponent(url.pathname);

  // Built-in td-cli control endpoints
  if (pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(\`Running on port \${PORT} with document root \${ROOT}\\n\`);
    return;
  }

  if (pathname === '/exit' && isLoopback(req.socket.remoteAddress)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Shutting down\\n', () => server.close(() => process.exit(0)));
    return;
  }

  // Add custom API routes here, e.g.:
  // if (pathname === '/api/hello') { ... }

  let filePath = path.resolve(ROOT, pathname.replace(/^\\/+/, ''));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden\\n');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not Found\\n');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(\`Started server.js in \${process.cwd()} on http://\${HOST}:\${PORT} (PID \${process.pid})\`);
});
`;
}
