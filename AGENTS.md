# Tripledollar DOM Scripting Guide

This project uses **[Tripledollar v2](https://tripledollar.net)** (`tripledollar`) for direct DOM scripting. Tripledollar is **not** a framework—it is a zero-dependency helper library for building web applications directly against the browser's live Document Object Model using plain JavaScript and native CSS.

Follow these principles whenever writing or modifying code in this project.

---

## 1. Core Principles

1. **Use a real programming language instead of markup**
   - Build all UI directly in JavaScript with `$$$` and `TDStruct`.
   - Do not write HTML strings, template engines, JSX, or Virtual DOM abstractions.
   - Keep `dist/index.html` as a minimal bootstrap shell with an empty `<body></body>`.
2. **Work directly with the real DOM**
   - `$$$()` returns real DOM `Element` nodes enhanced with chainable helpers.
   - Keep direct JavaScript references to created elements inside component closures and update them surgically instead of rebuilding entire views.
3. **Decompose into hierarchical, self-contained components**
   - Organize the application as a tree of small, independent UI components—not global Model/View/Controller layers or deep class hierarchies.
   - Each component owns its DOM subtree, co-located CSS, local state, and a small public interface.
4. **Separate structure/behavior from presentation**
   - JavaScript owns structure, state, and interaction; CSS owns layout and visual styling.
   - Toggle classes, attributes, or CSS custom properties (`--var`) from JavaScript instead of scattering inline styles.
5. **Keep dependencies minimal; use the Web Platform first**
   - Prefer native DOM APIs, native CSS (nesting, custom properties, Grid, Flexbox), `Event`/`CustomEvent`, `AbortController`, `fetch`, `Promise`, and ES Modules over third-party libraries.
6. **Keep a clean client/server boundary**
   - The client owns 100% of the UI. The server only serves static assets and JSON data APIs.

---

## 2. Project Structure & Workflow

A standard `td-cli` project layout:

```text
dist/
  index.html                  # Minimal bootstrap shell (do not put app markup here)
  bundle.js                   # Built output from Rollup
src/
  main.js                     # Entry point: composes top-level components and mounts with $$$.appendToDoc()
  main.css                    # Global/page-level styles
  components/
    <component-name>/
      index.js                # Component factory returning a TDElement
      style.css               # Co-located component CSS imported by index.js
server.js                     # Optional custom Node HTTP/API server (created with `td --init --server`)
rollup.config.js              # Bundles src/main.js + imported CSS into dist/bundle.js
```

Commands:

```sh
npm run build   # One-off Rollup build to dist/bundle.js
npm run watch   # Rebuild automatically on file changes
npm run start   # Start td dev server and open browser
npm run stop    # Stop td dev server
```

> **Note:** `rollup.config.js` outputs `format: 'iife'`, so do not use top-level `await` in `src/main.js`. Use `$$$.appendToDoc(...).then(...)` or an `async function main()` call.

---

## 3. Tripledollar v2 API Reference

```js
import $$$, { appendToDoc, onReady, destroy, structify, stringify, parse, namespace } from 'tripledollar';
```

### Constructing & Wrapping Elements

- **`$$$(ident, ...args)`** — Creates a DOM element.
  - `ident` is `tagName` (or `prefix:tagName` for XML/SVG namespaces) with optional `.class` and `#id` tokens in any order: `'section.card.featured#intro'`, `'svg:path'`, `'my-widget.active'`.
  - Remaining arguments may appear in any order:
    - **Attributes object**: `{ type: 'button', disabled: true, dataUserId: '42', class: 'extra', style: { '--gap': '8px' } }`
      - `true` produces a valueless boolean attribute (`disabled`); `false`, `null`, and `undefined` are omitted.
      - `class` merges with classes from `ident`.
      - Camel-cased `data*` keys become kebab-case `data-*` attributes (`dataUserId` → `data-user-id`); quote other hyphenated attributes like `'aria-label'`.
      - `style` accepts a CSS string or style object (including `--custom-properties`).
    - **Children**: DOM `Node`s, nested `TDStruct` arrays, arrays of children (`items.map(...)`), strings, and numbers.
    - **Falsy children skipped**: `false`, `null`, `undefined`, and `''` are ignored (`0` renders `"0"`), so inline conditionals work cleanly: `isAdmin && ['span.badge', 'Admin']`.
- **`$$$(existingElement)`** — Idempotently attaches Tripledollar helper methods to an existing DOM element.

### Element Helper Methods (Chainable, Non-Enumerable)

Every element created or wrapped by `$$$` exposes five methods:

- **`el.ins(...items)`** — Appends elements, `TDStruct` arrays, child lists, attributes, or text.
- **`el.evt(type, listener, options?)`** — Wrapper around `addEventListener(type, listener, options)` supporting `{ once, passive, capture, signal }`.
- **`el.css(styles)`** — Applies camelCase/kebab-case styles, CSS custom properties (`'--accent': '#fc0'`), removals (`null`/`undefined`), and nested selector maps (e.g., `{ '.cell': { width: '24px' } }`).
- **`el.set(key, value)`** — Sets a JavaScript property or method on the element.
- **`el.fun(name, ...args)`** — Invokes a method on the element inside a chain.

### Top-Level Functions

- **`$$$.appendToDoc(...items)`** — Waits for `DOMContentLoaded` if needed, appends nodes / `TDStruct` arrays to `document.body`, and returns a native `Promise<Node[]>`.
- **`$$$.onReady(callback)`** — Runs `callback` on `DOMContentLoaded` (or via `queueMicrotask` if already ready).
- **`$$$.destroy(el, removeSelf = false)`** — Clears all children via `replaceChildren()`, and removes `el` itself when `removeSelf` is `true`.
- **`$$$.structify(el, { trim }?)`** — Converts a live DOM subtree into a plain `TDStruct` array.
- **`$$$.stringify(el, { trim }?)`** — Serializes a live DOM element to a JSON `TDStruct` string (preserves SVG/custom namespaces).
- **`$$$.parse(json)`** — Parses a JSON `TDStruct` string directly into an enhanced `TDElement`.
- **`$$$.namespace(prefix, uri?)`** — Gets or registers an XML namespace URI (`svg`, `xlink`, `xhtml` are built in).

### Removed in v2 (Do Not Use)

| Legacy v1 API | Modern v2 Replacement |
| :--- | :--- |
| `$$$.query(sel)` / `el.query(sel)` | Keep direct JS refs, or use native `document.querySelector(sel)` / `el.querySelector(sel)` |
| `$$$.queryAll(sel)` / `el.queryAll(sel)` | Native `querySelectorAll(sel)` |
| `$$$.setImmediate(fn)` | Native `queueMicrotask(fn)` or `setTimeout(fn, 0)` |
| `el.evt('click', fn, arg1, arg2)` | Arrow function + options: `el.evt('click', (e) => fn(e, arg1, arg2), { signal })` |
| `define(['tripledollar'], ...)` (AMD/RequireJS) | ES Modules: `import $$$ from 'tripledollar'` |
| `$$$.parse(json)` returning an array | Returns a live `TDElement` (use `JSON.parse(json)` for raw arrays) |

---

## 4. TDStruct & SVG

A **`TDStruct`** is a plain, JSON-serializable array describing a DOM subtree:

```js
const userForm = [
  'form.user-form',
  ['label', 'Name', ['input', { name: 'name', type: 'text', required: true }]],
  ['label', 'Role', ['input', { name: 'role', type: 'text' }]],
  ['button', { type: 'submit' }, 'Save']
];

const formEl = $$$(userForm);
```

Because `TDStruct` is plain JavaScript data, build dynamic trees with normal expressions:

```js
const list = $$$(
  'ul.items',
  items.length === 0 && ['li.empty', 'No items yet.'],
  items.map((item) => ['li.item', { dataId: item.id }, item.label])
);
```

Use built-in namespaces for inline SVG:

```js
const icon = $$$(
  'svg.icon',
  { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true' },
  ['svg:circle', { cx: 12, cy: 12, r: 10, fill: 'currentColor' }]
);
```

---

## 5. Canonical Component Pattern

Model each UI unit as a module in `src/components/<name>/` with `index.js` and `style.css`:

- Export a **factory function** (`create<Name>(options)`) that returns a live `TDElement` so it drops directly into any `$$$(...)` or `TDStruct` tree and supports multiple independent instances.
- Hold **direct references** to dynamic child elements in the factory closure—do not use `document.querySelector` to find a component's own elements.
- Keep **data flowing down** via factory options and instance methods attached with `.set(...)` (or `Object.defineProperty` getters/setters when modeling a form-like `value`).
- Communicate **events upward** with standard `CustomEvent` (`{ detail, bubbles: true }`).
- Pass an **`AbortController` `signal`** to `.evt(...)` (especially for `window`/`document` listeners) and expose `.destroy()` for clean teardown.

**`src/components/counter/index.js`**

```js
import $$$ from 'tripledollar';
import './style.css';

export function createCounter({ label = 'Count', initial = 0 } = {}) {
  let value = initial;
  const controller = new AbortController();
  const { signal } = controller;

  const output = $$$('output.value', value);

  function setValue(next) {
    value = next;
    output.textContent = value;
    root.dispatchEvent(new CustomEvent('counter-change', { detail: { value }, bubbles: true }));
  }

  const root = $$$(
    'section.td-counter',
    ['span.label', label],
    $$$('button.step', { type: 'button', 'aria-label': 'Decrease' }, '-').evt(
      'click',
      () => setValue(value - 1),
      { signal }
    ),
    output,
    $$$('button.step', { type: 'button', 'aria-label': 'Increase' }, '+').evt(
      'click',
      () => setValue(value + 1),
      { signal }
    )
  )
    .set('getValue', () => value)
    .set('setValue', setValue)
    .set('destroy', () => {
      controller.abort();
      $$$.destroy(root, true);
    });

  return root;
}

export default createCounter;
```

**`src/components/counter/style.css`**

```css
.td-counter {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  & .value {
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  & .step {
    padding: 4px 10px;
    cursor: pointer;
  }
}
```

---

## 6. Updating the DOM

Avoid framework-style "re-render the whole component on every state change." Choose the smallest update that matches the change:

1. **Surgical updates (default)** — When text, state flags, or attributes change, mutate the referenced node directly:
   - `statusEl.textContent = message;`
   - `panelEl.classList.toggle('open', isOpen);`
   - `submitBtn.disabled = isLoading;`
   - `barEl.style.setProperty('--progress', `${pct}%`);`
2. **Subtree replacement** — When replacing a dynamic list or swapping a view container, clear and repopulate only that container:
   ```js
   $$$.destroy(listEl);
   listEl.ins(items.map((item) => createRow(item)));
   ```
3. **Event handling & delegation**:
   - Read `e.currentTarget` (the element the listener is attached to) rather than manually walking `e.target.parentNode`.
   - For large lists, attach one `.evt('click', ...)` listener to the parent container and locate the clicked item with `e.target.closest('[data-id]')`.

---

## 7. Styling, Accessibility & Security

- **Co-located CSS first**: Scope component rules under the root class with native CSS nesting (`&`), and use CSS custom properties (`--var`) for theming or dynamic values. Reserve `.css()` for runtime-computed styles.
- **Semantic HTML & accessibility**: Always use real interactive and landmark elements (`<button type="button">`, `<a href>`, `<label>`, `<form>`, `<main>`, `<nav>`, `<section>`, `<dialog>`, `aria-*`). Never make clickable `<div>` elements when `<button>` fits.
- **XSS-safe by construction**: Never assign `innerHTML`, `outerHTML`, or `insertAdjacentHTML`. Building nodes through `$$$` creates text nodes and DOM attributes safely.

---

## 8. Coding Craft & Anti-Patterns

- Write small, focused functions; prefer lookup/dispatch objects or short-circuit expressions over deeply nested `if`/`else` chains.
- Keep code self-documenting; add comments only to explain *why*, never to restate *what*.

| Do | Do Not |
| :--- | :--- |
| Build elements with `$$$` and `TDStruct` | Concatenate HTML strings or set `innerHTML` |
| Hold direct references to child nodes in closures | Query the document with `document.querySelector` inside reusable components |
| Update changed nodes surgically (`textContent`, `classList`, attributes) | Destroy and rebuild an entire component on every interaction |
| Return a `TDElement` from component factories with `.set()` APIs | Rely on module-level singletons tied to global CSS selectors |
| Pass `{ signal }` from `AbortController` to `.evt()` and clean up on `.destroy()` | Leave orphaned `window`/`document` listeners or timers behind |
| Use semantic `<button type="button">`, `<label>`, `<main>`, `<section>` | Use clickable `<div>` elements for buttons |
| Put layout and state styling in co-located `style.css` | Hardcode static layouts with `.css()` inline styles |
| Use native `querySelector`, ESM, `Promise`, and `$$$.destroy()` | Use removed v1 APIs (`$$$.query`, `$$$.setImmediate`, RequireJS) |
