import fs from 'node:fs';
import path from 'node:path';
import {
  indexHtml,
  packageJson,
  rollupConfig,
  mainJs,
  mainCss,
  demoComponentJs,
  demoComponentCss,
  optionalServerJs
} from './templates.js';

const CONFLICT_FILES = [
  'package.json',
  'rollup.config.js',
  'src/main.js',
  'src/main.css',
  'dist/index.html'
];

/**
 * Scaffold a new Tripledollar v2 + Rollup project.
 *
 * @param {{ cwd?: string; name?: string; includeServer?: boolean }} [options]
 * @returns {{ created: string[]; skipped: boolean }}
 */
export function initProject({ cwd = process.cwd(), name = 'Tripledollar', includeServer = false } = {}) {
  const conflicts = CONFLICT_FILES.filter((f) => fs.existsSync(path.join(cwd, f)));
  if (includeServer && fs.existsSync(path.join(cwd, 'server.js'))) {
    conflicts.push('server.js');
  }

  if (conflicts.length > 0) {
    console.error(`Aborted: existing file(s) would be overwritten: ${conflicts.join(', ')}`);
    return { created: [], skipped: true };
  }

  const files = [
    ['package.json', packageJson(name)],
    ['rollup.config.js', rollupConfig()],
    ['dist/index.html', indexHtml(name)],
    ['src/main.js', mainJs(name)],
    ['src/main.css', mainCss()],
    ['src/components/td-demo/index.js', demoComponentJs()],
    ['src/components/td-demo/style.css', demoComponentCss()]
  ];

  if (includeServer) {
    files.push(['server.js', optionalServerJs()]);
  }

  const created = [];
  for (const [relPath, content] of files) {
    const fullPath = path.join(cwd, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    created.push(relPath);
  }

  console.log(`\nCreated Tripledollar project "${name}" (${created.length} files):`);
  for (const f of created) {
    console.log(`  + ${f}`);
  }
  console.log('\nNext steps:');
  console.log('  npm install');
  console.log('  npm run build');
  console.log('  npm run start\n');

  return { created, skipped: false };
}
