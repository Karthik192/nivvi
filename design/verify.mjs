import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tokens = JSON.parse(await readFile(new URL('./tokens.json', import.meta.url), 'utf8'));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((first, second) => second - first);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const textPairs = [
  ['ink', 'canvas'], ['ink', 'surface'], ['ink', 'raised'],
  ['muted', 'canvas'], ['muted', 'surface'], ['muted', 'raised'],
  ['onPrimary', 'primary'], ['onAccent', 'accent'], ['onPeach', 'peach'], ['onLavender', 'lavender'],
  ['positive', 'positiveSurface'], ['warning', 'warningSurface'], ['danger', 'dangerSurface'],
  ['danger', 'canvas'], ['positive', 'canvas'], ['onDisabled', 'disabled'],
  ['muted', 'disabled'], ['ink', 'accent'], ['onAccent', 'accent'], ['danger', 'surface'], ['positive', 'surface']
];
const controlPairs = [['outline', 'canvas'], ['outline', 'surface'], ['outline', 'raised'], ['focus', 'canvas'], ['focus', 'surface']];
let checked = 0;
for (const [name, theme] of Object.entries(tokens.themes)) {
  for (const value of Object.values(theme)) assert.match(value, /^#[0-9A-F]{6}$/);
  assert.deepEqual(Object.keys(theme), Object.keys(tokens.themes.light));
  for (const [pairs, minimum] of [[textPairs, 4.5], [controlPairs, 3]]) {
    for (const [foreground, background] of pairs) {
      const ratio = contrast(theme[foreground], theme[background]);
      assert.ok(ratio >= minimum, `${name} ${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`);
      checked += 1;
    }
  }
}
assert.ok(tokens.size.tap >= 48);
assert.ok(tokens.size.control >= tokens.size.tap);
for (const value of Object.values(tokens.space)) assert.equal(value % 4, 0);
for (const spec of Object.values(tokens.type)) {
  if (typeof spec === 'object') { assert.ok(spec.line >= spec.size); assert.ok(spec.size >= 14); }
}
assert.equal(tokens.motion.reducedDuration, 0);
assert.ok(tokens.motion.celebration <= 700);
for (const name of ['mark', 'app-icon', 'empty-pot', 'achievement']) {
  const svg = await readFile(new URL(`./assets/${name}.svg`, import.meta.url), 'utf8');
  assert.match(svg, /viewBox=/);
  assert.ok(!/<script|https?:\/\/(?!www\.w3\.org)/i.test(svg), `${name}: remote or executable asset`);
}
console.log(`PASS: ${checked} contrast pairs, theme parity, spacing/type/motion invariants and four local SVG assets.`);
