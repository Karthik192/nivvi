export async function initializeTheme() {
  const response = await fetch('../tokens.json');
  if (!response.ok) throw new Error('Tokens unavailable');
  const tokens = await response.json();
  const root = document.documentElement;
  const themeControl = document.querySelector('#theme');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionControl = document.querySelector('#reduce-motion');
  motionControl.checked = systemMotion.matches;
  for (const [group, values] of Object.entries({ space: tokens.space, radius: tokens.radius, size: tokens.size })) {
    for (const [key, value] of Object.entries(values)) root.style.setProperty(`--${group}-${key}`, `${value}px`);
  }
  for (const [name, spec] of Object.entries(tokens.type)) {
    if (typeof spec !== 'object') continue;
    root.style.setProperty(`--type-${name}`, `${spec.size / 16}rem`);
    root.style.setProperty(`--line-${name}`, String(spec.line / spec.size));
    root.style.setProperty(`--weight-${name}`, String(spec.weight));
  }
  for (const name of ['press', 'feedback', 'transition', 'celebration']) root.style.setProperty(`--motion-${name}`, `${tokens.motion[name]}ms`);
  root.style.setProperty('--motion-ease', `cubic-bezier(${tokens.motion.ease.join(',')})`);
  root.style.setProperty('--press-scale', String(tokens.motion.pressScale));
  root.style.setProperty('--font', tokens.type.family);
  const applyTheme = () => {
    const theme = themeControl.value === 'system' ? (systemTheme.matches ? 'dark' : 'light') : themeControl.value;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    for (const [key, value] of Object.entries(tokens.themes[theme])) root.style.setProperty(`--${key}`, value);
    const shadow = tokens.elevation[theme];
    root.style.setProperty('--shadow', `0 ${shadow.offsetY}px ${shadow.blur}px ${shadow.colour}${Math.round(shadow.opacity * 255).toString(16).padStart(2, '0')}`);
    for (const swatch of document.querySelectorAll('[data-token]')) swatch.querySelector('code').textContent = tokens.themes[theme][swatch.dataset.token];
  };
  themeControl.addEventListener('change', applyTheme);
  systemTheme.addEventListener('change', applyTheme);
  motionControl.addEventListener('change', () => { root.dataset.reducedMotion = String(motionControl.checked); });
  systemMotion.addEventListener('change', () => {
    motionControl.checked = systemMotion.matches;
    root.dataset.reducedMotion = String(systemMotion.matches);
  });
  root.dataset.reducedMotion = String(motionControl.checked);
  document.querySelector('#text-scale').addEventListener('change', (event) => {
    root.style.fontSize = `${Number(event.target.value) * 100}%`;
    root.dataset.textScale = event.target.value;
  });
  applyTheme();
  return { tokens, applyTheme };
}
