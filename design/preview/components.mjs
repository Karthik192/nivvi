const svgNamespace = 'http://www.w3.org/2000/svg';

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button({ label, variant = 'primary', disabled = false, busy = false, onPress }) {
  const control = element('button', `button ${variant}`, label);
  control.type = 'button';
  control.disabled = disabled || busy;
  if (busy) {
    control.setAttribute('aria-busy', 'true');
    control.prepend(element('span', 'spinner'));
  }
  if (onPress) control.addEventListener('click', onPress);
  return control;
}

export function field({ id, label, hint, disabled = false, value = '' }) {
  const wrapper = element('div', 'field');
  const caption = element('label', '', label);
  caption.htmlFor = id;
  const input = element('input');
  input.id = id;
  input.name = id;
  input.type = 'text';
  input.value = value;
  input.disabled = disabled;
  input.maxLength = 80;
  input.autocomplete = 'off';
  input.setAttribute('aria-describedby', `${id}-hint ${id}-error`);
  const helper = element('p', 'field-hint', hint);
  helper.id = `${id}-hint`;
  const error = element('p', 'field-error');
  error.id = `${id}-error`;
  error.hidden = true;
  wrapper.append(caption, input, helper, error);
  return { wrapper, input, setError(message) {
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.textContent = message;
    error.hidden = !message;
  } };
}

export function status({ kind, title, description }) {
  const wrapper = element('div', `status ${kind}`);
  const symbol = element('span', 'status-symbol', { positive: '✓', warning: '!', danger: '!' }[kind]);
  symbol.setAttribute('aria-hidden', 'true');
  wrapper.append(symbol);
  const copy = element('div');
  copy.append(element('strong', '', title), element('p', '', description));
  wrapper.append(copy);
  return wrapper;
}

export function progressCard({ label, amount, detail, value, feature = false }) {
  const card = element('div', `progress-card ${feature ? 'feature-card' : ''}`);
  card.append(element('p', 'card-label', label), element('p', 'card-amount', amount));
  const track = element('div', 'progress-track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', label);
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  const fill = element('span', 'progress-fill');
  track.append(fill);
  const caption = element('p', 'card-detail', detail);
  card.append(track, caption);
  function update(nextValue, nextDetail = detail) {
    const boundedValue = Math.max(0, Math.min(100, nextValue));
    fill.style.width = `${boundedValue}%`;
    track.setAttribute('aria-valuenow', String(boundedValue));
    caption.textContent = nextDetail;
  }
  update(value);
  return { card, update };
}

const iconPaths = {
  home: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
  history: 'M4 4v5h5M4 9a8 8 0 1 1-1 6M12 8v5l3 2',
  insights: 'M5 20v-7M12 20V5M19 20V9',
  goals: 'M12 21s8-4 8-12V5l-8-3-8 3v4c0 8 8 12 8 12ZM8 12l3 3 5-6',
  food: 'M5 3v7M8 3v7M2 3v7h6M5 10v11M18 3c-4 0-5 8 0 8V3ZM18 11v10',
  groceries: 'M3 8h18l-2 12H5L3 8ZM8 8l4-6 4 6M9 12v4M15 12v4',
  shopping: 'M4 7h16l1 14H3L4 7ZM8 7V5a4 4 0 0 1 8 0v2',
  transport: 'M4 16V6c0-3 16-3 16 0v10H4ZM4 11h16M7 20v-4M17 20v-4M7 14h1M16 14h1',
  entertainment: 'm8 4 12 8-12 8V4Z',
  bills: 'M5 3h14v18l-4-2-3 2-3-2-4 2V3ZM9 8h6M9 12h6',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  education: 'm2 8 10-5 10 5-10 5L2 8ZM6 10v7c4 3 8 3 12 0v-7M22 8v9',
  travel: 'm3 13 7-2V4c0-3 4-3 4 0v7l7 2v3l-7-1v4l3 2H7l3-2v-4l-7 1v-3Z',
  subscriptions: 'M4 8h16v13H4V8ZM7 3h10M5 5h14M10 12l5 3-5 3v-6Z',
  other: 'M4 12h1M11 12h1M18 12h1',
  salary: 'M3 7h18v14H3V7ZM8 7V3h8v4M3 12h18M10 12v3h4v-3',
  freelance: 'M4 4h16v12H4V4ZM2 20h20M8 8l-2 2 2 2M16 8l2 2-2 2',
  investments: 'M3 20h18M5 16l5-6 4 3 6-9M15 4h5v5',
  gifts: 'M3 9h18v4H3V9ZM5 13v8h14v-8M12 9v12M12 9C2 9 5 0 10 5l2 4ZM12 9c10 0 7-9 2-4l-2 4Z'
};

export function icon(name) {
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('d', iconPaths[name] ?? iconPaths.other);
  svg.append(path);
  return svg;
}

export function navigation({ items, onChange }) {
  const nav = element('nav', 'bottom-navigation');
  nav.setAttribute('aria-label', 'Sample bottom navigation');
  for (const [index, item] of items.entries()) {
    const control = button({ label: item.label, variant: 'nav-item' });
    control.prepend(icon(item.icon));
    control.setAttribute('aria-pressed', String(index === 0));
    control.addEventListener('click', () => {
      for (const sibling of nav.children) sibling.setAttribute('aria-pressed', String(sibling === control));
      onChange(item.label);
    });
    nav.append(control);
  }
  return nav;
}

export function mascot(pose = 'idle') {
  const host = element('div', `mascot pose-${pose}`);
  const face = ['celebrate', 'goal', 'saved'].includes(pose)
    ? '<path d="m83 125 8-6 8 6m22 0 8-6 8 6" fill="none" stroke="#243729" stroke-width="5" stroke-linecap="round"/>'
    : '<ellipse cx="91" cy="124" rx="5" ry="7" fill="#243729"/><ellipse cx="129" cy="124" rx="5" ry="7" fill="#243729"/>';
  const mouth = pose === 'surprised'
    ? '<ellipse cx="110" cy="145" rx="7" ry="9" fill="#243729"/>'
    : '<path d="M101 141q9 10 18 0" fill="none" stroke="#243729" stroke-width="4" stroke-linecap="round"/>';
  const decoration = ['celebrate', 'goal'].includes(pose)
    ? '<path d="m30 60 4-10 4 10 10 4-10 4-4 10-4-10-10-4Zm148 14 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#D5976D"/>'
    : '';
  const symbol = pose === 'saved'
    ? '<circle cx="177" cy="73" r="18" fill="#284F3B"/><path d="m168 73 6 6 12-13" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>'
    : pose === 'goal'
      ? '<path d="m104 170-4 23 10-5 10 5-4-23" fill="#739E50"/><circle cx="110" cy="173" r="13" fill="#F4DDD0"/>'
      : pose === 'empty'
        ? '<path d="M170 185h24l-4 21h-16Z" fill="#DFAE91"/><path d="M182 185v-18q-15-9-13-17 15-1 13 17 2-15 15-15 2 13-15 15" fill="#98BA63"/>'
        : ['saving', 'attentive'].includes(pose)
          ? '<path d="M82 109q9-5 18-1m20 0q9-4 18 1" fill="none" stroke="#527C43" stroke-width="3" stroke-linecap="round"/>'
          : '';
  host.innerHTML = `<svg viewBox="0 0 220 240" aria-hidden="true"><ellipse cx="110" cy="217" rx="60" ry="10" fill="#243729" opacity=".08"/>${decoration}<path d="M102 75Q76 28 47 39q0 37 55 36Z" fill="#739E50"/><path d="M106 72q10-51 49-45-1 39-49 45Z" fill="#98BA63"/><path d="M109 80q-9-20-9-30" fill="none" stroke="#527C43" stroke-width="5" stroke-linecap="round"/><path d="M73 186q-9 27 6 28l17-2-1-23M126 189l-2 23 17 2q15-2 5-28" fill="#AFCB78"/><path d="M57 128q-28 8-23 27 10 11 29-1M161 128q28 8 23 27-10 11-29-1" fill="#AFCB78"/><path d="M110 66c45 0 65 42 62 82-2 39-23 57-62 57s-60-18-62-57c-3-40 17-82 62-82Z" fill="#D6EAA4"/><path d="M163 113q24 88-53 92-51-1-60-39 23 25 62 18 40-6 51-71Z" fill="#BCD585"/><ellipse cx="83" cy="98" rx="14" ry="7" transform="rotate(-35 83 98)" fill="#EEF6D8"/>${face}<ellipse cx="76" cy="140" rx="10" ry="5" fill="#DFAE91" opacity=".65"/><ellipse cx="144" cy="140" rx="10" ry="5" fill="#DFAE91" opacity=".65"/>${mouth}<path d="m110 167 10 7-10 10-10-10Z" fill="#F6F5E9"/><path d="M106 174h8" stroke="#7F9D56" stroke-width="2" stroke-linecap="round"/></svg>`;
  host.querySelector('svg').insertAdjacentHTML('beforeend', symbol);
  return host;
}
