import { button, element, field, icon, mascot, progressCard, status } from './components.mjs';
import { initializeTheme } from './theme.mjs';

const samples = [
  { merchant: 'Third Wave Coffee', category: 'Food', method: 'UPI', date: '09 Nov', amount: '₹240', kind: 'expense', icon: 'food' },
  { merchant: 'Fresh vegetables', category: 'Groceries', method: 'Cash', date: '09 Nov', amount: '₹1,260', kind: 'expense', icon: 'groceries' },
  { merchant: 'Metro recharge', category: 'Transportation', method: 'UPI', date: '08 Nov', amount: '₹60', kind: 'expense', icon: 'transport' },
  { merchant: 'November salary', category: 'Salary', method: 'Net banking', date: '01 Nov', amount: '₹65,000', kind: 'income', icon: 'salary' }
];

function jump(screenId) {
  const target = document.querySelector(`#${screenId} .app-scroll`);
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  target.focus({ preventScroll: true });
  document.querySelector('#prototype-feedback').textContent = `${screenId === 'expense' ? 'Add expense' : screenId} mockup focused. No financial data is stored.`;
}

function phone(id, title) {
  const figure = element('figure', 'screen-figure');
  figure.id = id;
  const caption = element('figcaption', '', title);
  caption.id = `${id}-caption`;
  const device = element('div', 'app-device');
  device.dataset.screen = id;
  const systemBar = element('div', 'system-bar');
  systemBar.setAttribute('aria-hidden', 'true');
  systemBar.append(element('span', '', '9:41'), element('span', '', '● ▰'));
  const header = element('div', 'app-header');
  const mark = element('img');
  mark.src = '../assets/mark.svg';
  mark.alt = '';
  header.append(element('span', 'eyebrow', 'Nivvi / sample'), mark);
  const content = element('section', 'app-scroll');
  content.tabIndex = 0;
  content.setAttribute('aria-labelledby', `${id}-caption`);
  const nav = element('nav', 'app-nav');
  nav.setAttribute('aria-label', `${title} sample navigation`);
  for (const [destination, label, iconName] of [['home', 'Home', 'home'], ['history', 'History', 'history'], ['insights', 'Insights', 'insights']]) {
    const link = element('a', '', label);
    link.href = `#${destination}`;
    link.prepend(icon(iconName));
    if (destination === id) link.setAttribute('aria-current', 'page');
    link.addEventListener('click', (event) => { event.preventDefault(); jump(destination); });
    nav.append(link);
  }
  device.append(systemBar, header, content, nav);
  figure.append(caption, device);
  document.querySelector('#screen-grid').append(figure);
  return content;
}

function transactionList(records) {
  const list = element('ul', 'transaction-list');
  for (const record of records) {
    const item = element('li', 'transaction-item');
    const symbol = element('span', 'transaction-icon');
    symbol.append(icon(record.icon));
    const copy = element('div', 'transaction-copy');
    copy.append(element('strong', '', record.merchant), element('span', '', `${record.category} · ${record.method}`), element('span', '', `${record.date} · ${record.kind === 'income' ? 'Income' : 'Expense'}`));
    item.append(symbol, copy, element('span', 'transaction-amount', `${record.kind === 'income' ? '+' : '−'}${record.amount}`));
    list.append(item);
  }
  return list;
}

function homeScreen() {
  const content = phone('home', '01 / Home');
  content.append(element('h2', '', 'A little more clarity.'), element('p', 'support', 'November 2026 · sample month'));
  content.append(progressCard({ label: 'Room in your budget', amount: '₹12,450', detail: '₹17,550 spent of ₹30,000 planned', value: 58.5, feature: true }).card);
  const stats = element('div', 'mini-stats');
  for (const [label, amount] of [['Income', '₹65,000'], ['Expenses', '₹17,550']]) {
    const stat = element('div');
    stat.append(element('span', '', label), element('strong', '', amount));
    stats.append(stat);
  }
  content.append(stats, button({ label: '+ Add expense', onPress: () => jump('expense') }));
  const companion = element('div', 'nim-message');
  const copy = element('p');
  copy.append(element('strong', '', 'One small win.'), document.createTextNode('You made time for your money.'));
  companion.append(mascot(), copy);
  content.append(companion, element('h3', '', 'Recent transactions'), transactionList(samples.slice(0, 3)));
  content.append(button({ label: 'See all transactions', variant: 'quiet', onPress: () => jump('history') }));
  const goal = element('section', 'app-section');
  goal.append(element('h3', '', 'A weekend away'), progressCard({ label: 'Savings goal · sample', amount: '₹8,000 of ₹20,000', detail: '40% there. At your pace.', value: 40 }).card);
  content.append(goal);
}

function selectField(id, label, options) {
  const wrapper = element('div', 'field');
  const caption = element('label', '', label);
  caption.htmlFor = id;
  const select = element('select');
  select.id = id;
  select.name = id;
  for (const text of options) {
    const option = element('option', '', text);
    select.append(option);
  }
  wrapper.append(caption, select);
  return wrapper;
}

function expenseScreen() {
  const content = phone('expense', '02 / Add Expense');
  content.append(element('h2', '', 'Add an expense'), element('p', 'support', 'A quick note for future you. Preview only.'));
  const form = element('form');
  form.id = 'expense-form';
  form.noValidate = true;
  const amount = field({ id: 'expense-amount', label: 'Amount in rupees', hint: 'INR · enter up to two decimal places.', value: '240' });
  amount.input.classList.add('amount-input');
  amount.input.inputMode = 'decimal';
  amount.input.required = true;
  const categories = element('fieldset');
  categories.append(element('legend', '', 'Category'));
  const categoryGrid = element('div', 'expense-categories');
  for (const [index, [name, iconName]] of [['Food', 'food'], ['Groceries', 'groceries'], ['Transport', 'transport'], ['Shopping', 'shopping'], ['Bills', 'bills'], ['Other', 'other']].entries()) {
    const label = element('label');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'expense-category';
    radio.value = name;
    radio.checked = index === 0;
    label.append(icon(iconName), element('span', '', name), radio);
    categoryGrid.append(label);
  }
  categories.append(categoryGrid);
  const merchant = field({ id: 'expense-merchant', label: 'Merchant or payee (optional)', hint: 'Where did it go?', value: 'Third Wave Coffee' });
  const date = field({ id: 'expense-date', label: 'Transaction date', hint: 'Shown in your reporting timezone: Asia/Kolkata.', value: '2026-11-09' });
  date.input.type = 'date';
  date.input.required = true;
  const note = field({ id: 'expense-note', label: 'Note (optional)', hint: 'Add a little context, if you like.' });
  const submit = button({ label: 'Preview save expense' });
  submit.type = 'submit';
  submit.classList.add('full-width');
  const feedback = element('p', 'app-feedback');
  feedback.id = 'expense-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-atomic', 'true');
  const savePreview = element('div', 'save-preview');
  savePreview.hidden = true;
  savePreview.append(status({ kind: 'warning', title: 'Saved on this device', description: 'Example local-save message. Waiting for connection.' }), status({ kind: 'positive', title: 'Synced to your account', description: 'Example server-confirmation message. Shown only after acknowledgement.' }));
  form.append(amount.wrapper, categories, merchant.wrapper, selectField('expense-payment', 'Payment method', ['UPI', 'Cash', 'Debit card', 'Credit card', 'Net banking', 'Other']), date.wrapper, note.wrapper, submit, feedback, savePreview);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const validAmount = /^\d{1,10}(\.\d{1,2})?$/.test(amount.input.value.trim()) && /[1-9]/.test(amount.input.value);
    const validDate = Boolean(date.input.value) && date.input.validity.valid;
    amount.setError(validAmount ? '' : 'Enter an amount above ₹0, with at most two decimal places.');
    date.setError(validDate ? '' : 'Choose a valid transaction date.');
    savePreview.hidden = true;
    if (!validAmount || !validDate) {
      feedback.dataset.kind = 'error';
      feedback.textContent = 'Check the highlighted field. No entry was saved.';
      (!validAmount ? amount.input : date.input).focus();
      return;
    }
    feedback.dataset.kind = 'success';
    feedback.textContent = 'Save feedback previewed. No expense was stored or synced.';
    savePreview.hidden = false;
  });
  for (const control of [amount, date]) control.input.addEventListener('input', () => {
    control.setError('');
    feedback.textContent = '';
    savePreview.hidden = true;
  });
  content.append(form);
}

function historyScreen() {
  const content = phone('history', '03 / Transaction History');
  content.append(element('h2', '', 'The little details.'), element('p', 'support', 'November 2026 · sample history'));
  const search = field({ id: 'history-search', label: 'Search transactions', hint: 'Search the sample merchant or category.' });
  search.input.type = 'search';
  const filters = element('div', 'history-filter');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Transaction type');
  const results = element('div');
  results.id = 'history-results';
  const count = element('p', 'support');
  count.id = 'history-count';
  count.setAttribute('role', 'status');
  let selected = 'all';
  const update = () => {
    const query = search.input.value.trim().toLocaleLowerCase('en-IN');
    const records = samples.filter((sample) => (selected === 'all' || sample.kind === selected) && `${sample.merchant} ${sample.category}`.toLocaleLowerCase('en-IN').includes(query));
    count.textContent = `${records.length} sample ${records.length === 1 ? 'entry' : 'entries'}`;
    results.replaceChildren(records.length ? transactionList(records) : element('p', 'history-empty', 'No matching entries. Try another search or filter.'));
  };
  for (const [value, label] of [['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']]) {
    const control = button({ label, variant: 'secondary', onPress: () => {
      selected = value;
      for (const sibling of filters.children) sibling.setAttribute('aria-pressed', String(sibling === control));
      update();
    } });
    control.setAttribute('aria-pressed', String(value === selected));
    filters.append(control);
  }
  search.input.addEventListener('input', update);
  content.append(search.wrapper, filters, count, results);
  update();
}

function insightsScreen() {
  const content = phone('insights', '04 / Insights');
  content.append(element('h2', '', 'Find your rhythm.'), element('p', 'support', 'November 2026 · sample analysis'));
  content.append(progressCard({ label: 'Expenses · share of income', amount: '₹17,550', detail: '27% of ₹65,000 income · ₹47,450 surplus', value: 27, feature: true }).card);
  content.append(element('p', 'support', 'Surplus is income minus expenses, not a verified bank balance.'));
  const chart = element('section', 'chart');
  chart.append(element('h3', '', 'Spending this month'));
  const graphic = element('div');
  graphic.setAttribute('aria-hidden', 'true');
  const bars = element('div', 'chart-bars');
  for (const height of [100, 37.1, 0, 0]) {
    const bar = element('span', 'chart-bar');
    bar.style.height = `${height}%`;
    bars.append(bar);
  }
  const days = element('div', 'chart-days');
  for (const label of ['1–7', '8–14', '15–21', '22–30']) days.append(element('span', '', label));
  graphic.append(bars, days);
  const table = element('table', 'chart-table');
  table.append(element('caption', '', 'Weekly amounts in INR; includes sample data through 09 Nov.'));
  const body = element('tbody');
  for (const [period, amount] of [['01–07 Nov', '₹12,800'], ['08–14 Nov', '₹4,750'], ['15–21 Nov', '₹0'], ['22–30 Nov', '₹0']]) {
    const row = element('tr');
    const heading = element('th', '', period);
    heading.scope = 'row';
    row.append(heading, element('td', '', amount));
    body.append(row);
  }
  table.append(body);
  chart.append(graphic, table);
  content.append(chart);
  const categories = element('section', 'app-section');
  categories.append(element('h3', '', 'Where it went'));
  const list = element('ul', 'category-breakdown');
  for (const [name, amount, value] of [['Food', '₹6,150', 35], ['Groceries', '₹5,250', 30], ['Transportation', '₹3,150', 18], ['Other categories', '₹3,000', 17]]) {
    const item = element('li');
    const row = element('div', 'row');
    row.append(element('span', '', name), element('strong', '', amount));
    const track = element('div', 'progress-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = element('span', 'progress-fill');
    fill.style.width = `${value}%`;
    track.append(fill);
    item.append(row, track);
    list.append(item);
  }
  categories.append(list);
  content.append(categories, element('p', 'comparison-note', '₹2,250 less than October’s sample expenses of ₹19,800.'));
}

initializeTheme().then(() => {
  homeScreen();
  expenseScreen();
  historyScreen();
  insightsScreen();
  document.documentElement.dataset.ready = 'true';
}).catch(() => { document.querySelector('#load-error').hidden = false; });
