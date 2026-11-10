import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Phase 3 contract: the production export must not render the design preview.
const directory = resolve(process.argv[2] ?? 'apps/mobile/dist/phase3-web');
const pages = ['home', 'transactions', 'insights', 'goals', 'transaction'];
const index = readFileSync(resolve(directory, 'index.html'), 'utf8');
assert(index.includes('Development preview only'), 'Production entry notice is missing.');
const previewContent = [
  'A little more clarity.',
  'The little details.',
  'Find your rhythm.',
  'A little closer',
  'A quick note for future you.',
  'Room in your budget',
  'Third Wave Coffee',
];
for (const page of pages) {
  const html = readFileSync(resolve(directory, `${page}.html`), 'utf8');
  assert(
    !previewContent.some((text) => html.includes(text)),
    `Preview UI rendered in production page: ${page}`,
  );
}
const output = resolve('docs/review/phase3');
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, 'production-gate.json'),
  `${JSON.stringify({ status: 'passed', rootNotice: true, protectedPages: pages, renderedPreviewContent: false, checkedAt: new Date().toISOString(), limitation: 'Static production rendering check; native release execution is not verified.' }, null, 2)}\n`,
);
console.log('PASS: production notice and protected pages render no preview UI or sample records.');
