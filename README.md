# td-cli

Zero-dependency command-line scaffolding tool and static HTTP development server for **[Tripledollar v2](https://tripledollar.net)** ([GitHub](https://github.com/steenk/tripledollar)) projects.

## Installation

```sh
npm install -g td-cli
```

Or link locally during development:

```sh
cd /path/to/td-cli
npm link
```

## Usage

```text
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
  -h, --help           Show this help text
```

## Quick Start

```sh
mkdir my-app && cd my-app
td --init --name "My App"
npm install
npm run build
npm run start
```

### Testing with a local `tripledollar` checkout (`npm link`)

```sh
# 1. In the tripledollar v2 repo:
cd /path/to/tripledollar
npm run build
npm link

# 2. In your scaffolded project:
cd /path/to/my-app
npm install
npm link tripledollar
npm run build
npm run start
```

### Custom `server.js` (Optional)

By default `td --start` serves `dist/` (or the current directory) with its built-in Node `http` static server. If you need custom backend endpoints, pass `--server` when scaffolding:

```sh
td --init --server
```

Whenever a `server.js` file exists in your project root, `td --start` runs it instead and passes `TD_PORT` and `TD_HOST` via environment variables.
