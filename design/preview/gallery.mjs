import { button, element, field, icon, mascot, navigation, progressCard, status } from './components.mjs';
import { initializeTheme } from './theme.mjs';

async function initialize() {
  const { applyTheme } = await initializeTheme();
  const root = document.documentElement;

  const palette = document.querySelector('#palette');
  for (const [token, name] of [['canvas', 'Oat'], ['primary', 'Forest'], ['accent', 'Leaf'], ['peach', 'Apricot'], ['ink', 'Ink']]) {
    const swatch = element('div', 'swatch');
    swatch.dataset.token = token;
    const colour = element('span', 'swatch-colour');
    colour.style.background = `var(--${token})`;
    swatch.append(colour, element('strong', '', name), element('code'));
    palette.append(swatch);
  }
  applyTheme();

  const budget = progressCard({ label: 'Room in your budget', amount: '₹12,450', detail: '₹17,550 of ₹30,000 spent · sample', value: 58.5, feature: true });
  budget.update(58.5);
  document.querySelector('#budget-sample').append(budget.card);
  document.querySelector('#hero-mascot').append(mascot());
  const descriptions = { Home: 'Home · a calm summary of your month.', History: 'History · clear, searchable entries.', Insights: 'Insights · patterns, without judgement.', Goals: 'Goals · a little closer, at your pace.' };
  const setNavigation = (label) => { document.querySelector('#navigation-content').textContent = descriptions[label]; };
  document.querySelector('#navigation-sample').append(navigation({ items: [{ label: 'Home', icon: 'home' }, { label: 'History', icon: 'history' }, { label: 'Insights', icon: 'insights' }, { label: 'Goals', icon: 'goals' }], onChange: setNavigation }));
  setNavigation('Home');

  const feedback = document.querySelector('#button-feedback');
  for (const sample of [
    { label: 'Try primary action', variant: 'primary' },
    { label: 'Try secondary action', variant: 'secondary' },
    { label: 'Try quiet action', variant: 'quiet' },
    { label: 'Try destructive feedback', variant: 'destructive' },
    { label: 'Unavailable · disabled', disabled: true },
    { label: 'Saving · state sample', busy: true }
  ]) {
    document.querySelector('#button-samples').append(button({ ...sample, onPress: () => { feedback.textContent = `${sample.label.replace('Try ', '')} previewed. No records changed.`; } }));
  }
  const nameField = field({ id: 'sample-name', label: 'Goal name', hint: 'For example, a weekend away. Up to 80 characters.' });
  const disabledField = field({ id: 'sample-currency', label: 'Currency · read-only sample', hint: 'INR is the first-release currency.', disabled: true, value: 'INR · Indian rupee' });
  document.querySelector('#input-samples').append(nameField.wrapper, disabledField.wrapper);
  document.querySelector('#sample-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const valid = Boolean(nameField.input.value.trim());
    nameField.setError(valid ? '' : 'Add a short name for this sample goal.');
    document.querySelector('#form-feedback').textContent = valid ? 'Looks good. This was a preview; no goal was created.' : 'Please check the goal name.';
    if (!valid) nameField.input.focus();
  });
  nameField.input.addEventListener('input', () => { nameField.setError(''); });

  const categoryGrid = document.querySelector('#category-samples');
  const categories = ['Food', 'Groceries', 'Shopping', 'Transport', 'Entertainment', 'Bills', 'Health', 'Education', 'Travel', 'Subscriptions', 'Other', 'Salary', 'Freelance', 'Investments', 'Gifts'];
  for (const [index, name] of categories.entries()) {
    const category = button({ label: name, variant: 'category' });
    category.prepend(icon(name.toLowerCase()));
    category.setAttribute('aria-pressed', String(index === 0));
    category.addEventListener('click', () => {
      for (const sibling of categoryGrid.children) sibling.setAttribute('aria-pressed', String(sibling === category));
      document.querySelector('#category-feedback').textContent = `${name} selected in this preview.`;
    });
    categoryGrid.append(category);
  }

  for (const spec of [
    { kind: 'warning', title: 'Saved on this device', description: 'Waiting to sync. Open Nivvi when connected.' },
    { kind: 'positive', title: 'Synced to your account', description: 'The server has confirmed this entry.' },
    { kind: 'danger', title: 'Needs your attention', description: 'Review this entry before trying again.' }
  ]) document.querySelector('#status-samples').append(status(spec));
  document.querySelector('#empty-action').addEventListener('click', () => { document.querySelector('#empty-feedback').textContent = 'Start with an amount and category. Entry screens arrive in Phase 3.'; });

  const goal = progressCard({ label: 'A weekend away · sample', amount: 'A little closer.', detail: '40% of your sample goal', value: 40 });
  goal.update(40);
  document.querySelector('#goal-sample').append(goal.card);
  document.querySelector('#progress').addEventListener('input', (event) => {
    const value = Number(event.target.value);
    document.querySelector('#progress-value').textContent = `${value}%`;
    goal.update(value, value === 100 ? 'Sample milestone reached. Nicely done!' : `${value}% of your sample goal`);
  });

  const stateResponse = await fetch('../nim-states.json');
  if (!stateResponse.ok) throw new Error('Character specification unavailable');
  const { states } = await stateResponse.json();
  const posePicker = document.querySelector('#pose-picker');
  const stage = document.querySelector('#mascot-stage');
  stage.append(mascot());
  document.querySelector('#pose-description').textContent = states.idle.copy;
  for (const [index, [pose, state]] of Object.entries(states).entries()) {
    const control = button({ label: state.label, variant: 'secondary' });
    control.setAttribute('aria-pressed', String(index === 0));
    control.addEventListener('click', () => {
      for (const sibling of posePicker.children) sibling.setAttribute('aria-pressed', String(sibling === control));
      stage.replaceChildren(mascot(pose));
      document.querySelector('#pose-description').textContent = state.copy;
    });
    posePicker.append(control);
  }
  root.dataset.ready = 'true';
}

initialize().catch(() => { document.querySelector('#load-error').hidden = false; });
