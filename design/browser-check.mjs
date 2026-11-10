import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const executable = process.argv[2];
assert.ok(executable, 'Pass the full path to an installed Chrome/Chromium executable.');
const profile = await mkdtemp(join(tmpdir(), 'nivvi-design-'));
const output = fileURLToPath(new URL('./review/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
let counter = 0;
const pending = new Map();
const errors = [];
function command(method, params = {}) {
  const id = ++counter;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function screenshot(name, selector) {
  const metrics = await command('Page.getLayoutMetrics');
  const size = metrics.cssContentSize;
  const clip = selector ? await evaluate(`(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height, scale: 1 }; })()`) : { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
  await writeFile(join(output, name), Buffer.from(result.data, 'base64'));
}
try {
  let port;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(port, 'Browser did not expose a debugging port.');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:4173`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    const task = pending.get(message.id);
    if (!task) return;
    clearTimeout(task.timeout);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
  });
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: 'http://127.0.0.1:4173' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate('document.documentElement?.dataset.ready === "true"')) break;
    await delay(100);
  }
  assert.equal(await evaluate('document.documentElement.dataset.ready'), 'true', 'Gallery initialization');
  const select = async (id, value) => evaluate(`(() => { const control = document.getElementById(${JSON.stringify(id)}); control.value = ${JSON.stringify(value)}; control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await select('theme', 'light');
  await evaluate('document.activeElement?.blur()');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate('document.activeElement.className'), 'skip-link', 'Keyboard skip link is first');
  assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'solid', 'Visible keyboard focus');
  await evaluate('document.activeElement.blur()');
  await screenshot('desktop-light.png');
  await select('theme', 'dark');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await screenshot('desktop-dark.png');
  await select('theme', 'light');
  await evaluate('document.querySelector("#sample-form button").click()');
  assert.equal(await evaluate('document.querySelector("#sample-name").getAttribute("aria-invalid")'), 'true');
  assert.equal(await evaluate('document.activeElement.id'), 'sample-name');
  await evaluate('document.querySelector("#sample-name").value = "Weekend away"; document.querySelector("#sample-form button").click()');
  assert.equal(await evaluate('document.querySelector("#sample-name").getAttribute("aria-invalid")'), 'false');
  assert.match(await evaluate('document.querySelector("#form-feedback").textContent'), /no goal was created/);
  await evaluate('document.querySelector("#button-samples button").click()');
  assert.match(await evaluate('document.querySelector("#button-feedback").textContent'), /previewed/);
  const previousFeedback = await evaluate('document.querySelector("#button-feedback").textContent');
  await evaluate('document.querySelectorAll("#button-samples button")[4].click(); document.querySelectorAll("#button-samples button")[5].click()');
  assert.equal(await evaluate('document.querySelector("#button-feedback").textContent'), previousFeedback, 'Disabled/busy buttons cannot submit');
  await evaluate('document.querySelectorAll("#category-samples button")[6].click()');
  assert.match(await evaluate('document.querySelector("#category-feedback").textContent'), /Health/);
  assert.equal(await evaluate('document.querySelectorAll("#category-samples [aria-pressed=true]").length'), 1);
  await evaluate('document.querySelectorAll("#navigation-sample button")[2].click()');
  assert.match(await evaluate('document.querySelector("#navigation-content").textContent'), /Insights/);
  await evaluate('document.querySelectorAll("#pose-picker button")[1].click()');
  assert.equal(await evaluate('Boolean(document.querySelector("#mascot-stage .pose-celebrate"))'), true);
  await evaluate('document.querySelector("#empty-action").click()');
  assert.match(await evaluate('document.querySelector("#empty-feedback").textContent'), /amount and category/);
  await evaluate('document.querySelector("#progress").value = 100; document.querySelector("#progress").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelector("#goal-sample [role=progressbar]").getAttribute("aria-valuenow")'), '100');
  assert.match(await evaluate('document.querySelector("#goal-sample .card-detail").textContent'), /milestone/);
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await delay(50);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".spinner")).animationName'), 'none');
  await evaluate('document.querySelector("#reduce-motion").checked = true; document.querySelector("#reduce-motion").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".button")).transitionDuration'), '0s');
  for (const width of [390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: false });
    for (const scale of ['1', '2']) {
      await select('text-scale', scale);
      const overflow = await evaluate('({ width: innerWidth, content: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll("body *")].filter(node => node.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(node).position !== "fixed").slice(0, 8).map(node => ({ tag: node.tagName, class: String(node.className), text: node.textContent.slice(0, 35) })) })');
      assert.ok(overflow.content <= width + 1, `Horizontal overflow at ${width}px / ${scale}x: ${JSON.stringify(overflow)}`);
    }
  }
  await select('text-scale', '1');
  const skipLink = await evaluate('({ active: document.activeElement.className, bottom: document.querySelector(".skip-link").getBoundingClientRect().bottom, transform: getComputedStyle(document.querySelector(".skip-link")).transform })');
  assert.ok(skipLink.bottom <= 0, `Skip link stays hidden unless focused: ${JSON.stringify(skipLink)}`);
  await screenshot('mobile-light.png');
  await select('theme', 'dark');
  await screenshot('mobile-dark.png');
  await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: 'http://127.0.0.1:4173/preview/screens.html' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate('document.documentElement?.dataset.ready === "true" && Boolean(document.querySelector("#expense-form"))')) break;
    await delay(100);
  }
  assert.equal(await evaluate('document.querySelectorAll(".app-device").length'), 4);
  const audit = [];
  for (const theme of ['light', 'dark']) {
    await select('theme', theme);
    for (const id of ['home', 'expense', 'history', 'insights']) {
      await screenshot(`${id}-${theme}.png`, `#${id} .app-device`);
    }
    await screenshot(`screens-${theme}.png`);
    const rendered = await evaluate(`(() => {
      const rgb = value => value.match(/[\\d.]+/g)?.map(Number);
      return [...document.querySelectorAll('body *')].filter(node => {
        if (!node.getClientRects().length || node.closest('svg, [aria-hidden="true"]')) return false;
        return [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()) || node.matches('input, select, textarea');
      }).map(node => {
        const style = getComputedStyle(node);
        let parent = node;
        let background;
        while (parent) {
          const candidate = rgb(getComputedStyle(parent).backgroundColor);
          if (candidate && (candidate.length === 3 || candidate[3] === 1)) { background = candidate.slice(0,3); break; }
          parent = parent.parentElement;
        }
        return { text: (node.value || node.textContent).trim().slice(0,60), foreground: rgb(style.color)?.slice(0,3), background, size: parseFloat(style.fontSize), selector: node.id || node.className };
      });
    })()`);
    const luminance = (channels) => channels.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    for (const node of rendered) {
      assert.ok(node.size >= 14, `Readable minimum: ${JSON.stringify(node)}`);
      assert.ok(node.foreground && node.background, `Resolved text colours: ${JSON.stringify(node)}`);
      const levels = [luminance(node.foreground), luminance(node.background)].sort((first, second) => second - first);
      const ratio = (levels[0] + .05) / (levels[1] + .05);
      assert.ok(ratio >= 4.5, `${theme} rendered contrast ${ratio.toFixed(2)}: ${JSON.stringify(node)}`);
    }
    audit.push({ theme, checkedTextNodes: rendered.length, minimumTextPx: Math.min(...rendered.map(node => node.size)), minimumContrastTarget: 4.5 });
  }
  await evaluate('document.querySelector("#home .button.primary").click()');
  assert.equal(await evaluate('document.activeElement.closest("figure").id'), 'expense');
  await evaluate('document.querySelector("#expense-amount").value = "0"; document.querySelector("#expense-form button[type=submit]").click()');
  assert.equal(await evaluate('document.activeElement.id'), 'expense-amount');
  assert.equal(await evaluate('document.querySelector("#expense-amount").getAttribute("aria-invalid")'), 'true');
  await evaluate('document.querySelector("#expense-amount").value = "240.50"; document.querySelector("#expense-form button[type=submit]").click()');
  assert.match(await evaluate('document.querySelector("#expense-feedback").textContent'), /No expense was stored or synced/);
  assert.equal(await evaluate('document.querySelector(".save-preview").hidden'), false);
  for (const theme of ['light', 'dark']) {
    await select('theme', theme);
    await evaluate('document.querySelector("#expense .app-scroll").scrollTop = document.querySelector("#expense .app-scroll").scrollHeight');
    await screenshot(`expense-feedback-${theme}.png`, '#expense .app-device');
  }
  await evaluate('document.querySelector("#history-search").value = "coffee"; document.querySelector("#history-search").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelectorAll("#history-results li").length'), 1);
  await evaluate('document.querySelector("#history-search").value = "no match"; document.querySelector("#history-search").dispatchEvent(new Event("input"))');
  assert.match(await evaluate('document.querySelector("#history-results").textContent'), /No matching entries/);
  await evaluate('document.querySelector("#history-search").value = ""; document.querySelector("#history-search").dispatchEvent(new Event("input")); document.querySelectorAll(".history-filter button")[2].click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-results li").length'), 1);
  assert.match(await evaluate('document.querySelector("#history-results").textContent'), /salary/);
  await command('Accessibility.enable');
  const tree = await command('Accessibility.getFullAXTree');
  const unnamedControls = tree.nodes.filter(node => !node.ignored && ['button', 'textbox', 'searchbox', 'combobox', 'radio', 'link'].includes(node.role?.value) && !node.name?.value?.trim());
  assert.deepEqual(unnamedControls, [], 'All exposed controls have accessible names');
  assert.ok(tree.nodes.some(node => node.role?.value === 'table'), 'Chart has accessible text table');
  assert.ok(tree.nodes.some(node => node.role?.value === 'status'), 'Feedback exposed as live status');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await delay(50);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".progress-fill")).transitionDuration'), '0s');
  for (const width of [390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: false });
    for (const scale of ['1', '1.3', '1.5', '2']) {
      await select('text-scale', scale);
      const sizes = await evaluate('[...document.querySelectorAll(".app-scroll")].map(node => ({ id: node.parentElement.dataset.screen, width: node.clientWidth, content: node.scrollWidth, height: node.clientHeight, offenders: [...node.querySelectorAll("*")].filter(child => child.getBoundingClientRect().right > node.getBoundingClientRect().right + 1).slice(0,5).map(child => ({ tag: child.tagName, id: child.id, class: String(child.className), text: child.textContent.slice(0,40) })) }))');
      for (const size of sizes) assert.ok(size.content <= size.width + 1 && size.height > 100, `Screen scroll/text reflow ${width}px / ${scale}x: ${JSON.stringify(size)}`);
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `Study document reflow ${width}px / ${scale}x`);
    }
  }
  await evaluate('document.activeElement?.blur(); const device = document.querySelector("#expense .app-device"); document.body.replaceChildren(device); device.querySelector(".app-scroll").scrollTop = 0; window.scrollTo({ top: 0, left: 0, behavior: "instant" })');
  await screenshot('expense-200-percent.png');
  await writeFile(join(output, 'accessibility-results.json'), JSON.stringify({ renderedText: audit, screenSizesChecked: [320, 390], textScalesChecked: [1, 1.3, 1.5, 2], accessibleControlNames: 'pass', chartTable: 'pass', reducedMotion: 'pass', nativeTalkBack: 'not run' }, null, 2));
  assert.deepEqual(errors, [], 'No browser runtime exceptions');
  console.log('PASS: gallery regression; four app mockups in both themes; real rendered text contrast/minimum sizes; form/navigation/search; accessible control names/chart table; reduced motion; 320/390px at 100/130/150/200% text. Screenshots and accessibility-results.json saved.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await command('Browser.close'); } catch { browser.kill(); }
  } else browser.kill();
  socket?.close();
  for (const task of pending.values()) clearTimeout(task.timeout);
}
