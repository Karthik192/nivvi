import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const directory = resolve(process.argv[2] ?? 'apps/mobile/.local/phase5-web-export');
const routes = ['index', 'home', 'transactions', 'insights', 'goals', 'transaction'];
const forbidden = ['Development preview only', 'Third Wave Coffee'];
for (const route of routes) {
  const html = readFileSync(resolve(directory, `${route}.html`), 'utf8');
  assert(
    !forbidden.some((text) => html.includes(text)),
    `Development preview content rendered in production route: ${route}`,
  );
}
const report = {
  status: 'passed',
  routes,
  previewContentRendered: false,
  checkedAt: new Date().toISOString(),
  limitation:
    'Static HTML check only. Routes render the secure-session bootstrap until client startup; this does not verify an Android release build or production API.',
};
const output = resolve('docs/review/phase5/production-gate.json');
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`PASS: no preview-only content appears in ${routes.length} production static routes.`);
