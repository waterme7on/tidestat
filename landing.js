const demoFrame = document.querySelector('.demo-shell iframe');
if (demoFrame) {
  demoFrame.addEventListener('error', () => {
    document.querySelector('.demo-fallback').hidden = false;
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const siteNavigation = document.querySelector('#site-navigation');
function closeMenu() {
  menuToggle?.setAttribute('aria-expanded', 'false');
  siteNavigation?.classList.remove('is-open');
}
menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  siteNavigation.classList.toggle('is-open', open);
});
siteNavigation?.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') {
    closeMenu(); menuToggle.focus();
  }
});

const demoOpen = document.getElementById('demoOpenLink');
const demoViews = { journeys: { src: './live.html?demo=1&embed=1&view=park', open: './live.html?demo=1&view=park' }, live: { src: './live.html?demo=1&embed=1', open: './live.html?demo=1' }, revenue: { src: './revenue.html?demo=1&embed=1', open: './revenue.html?demo=1' } };
for (const tab of document.querySelectorAll('.demo-tab')) tab.addEventListener('click', () => {
  const view = demoViews[tab.dataset.demo]; if (!view || tab.classList.contains('active')) return;
  for (const other of document.querySelectorAll('.demo-tab')) { other.classList.toggle('active', other === tab); other.setAttribute('aria-selected', String(other === tab)); }
  demoFrame.dataset.demoView = tab.dataset.demo; demoFrame.src = view.src; demoOpen.href = view.open;
  for (const hint of document.querySelectorAll('[data-demo-hint]')) hint.hidden = hint.dataset.demoHint !== tab.dataset.demo;
});

const visitChart = document.querySelector('[data-spec-chart]');
if (visitChart) {
  const svg = visitChart.querySelector('.spec-svg');
  const points = JSON.parse(svg.dataset.points);
  const label = visitChart.querySelector('.spec-head span');
  const value = visitChart.querySelector('.spec-head strong');
  const delta = visitChart.querySelector('.spec-delta');
  const cursor = visitChart.querySelector('.spec-cursor');
  const cross = visitChart.querySelector('.spec-cross');
  let index = points.length - 1;
  let held = false;
  const paint = i => {
    index = Math.max(0, Math.min(points.length - 1, i));
    const [x, y, visits, day] = points[index];
    const previous = index ? points[index - 1][2] : null;
    cursor.setAttribute('cx', x);
    cursor.setAttribute('cy', y);
    cross.setAttribute('x1', x);
    cross.setAttribute('x2', x);
    label.textContent = day;
    value.textContent = String(visits);
    delta.textContent = previous == null ? '—' : `${visits - previous > 0 ? '+' : ''}${visits - previous}`;
    visitChart.setAttribute('aria-valuenow', String(index));
    visitChart.setAttribute('aria-valuetext', `${day} ${visits}`);
  };
  const fromClient = clientX => {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 320;
    let best = 0;
    points.forEach((point, i) => { if (Math.abs(point[0] - x) < Math.abs(points[best][0] - x)) best = i; });
    visitChart.classList.add('is-scrubbing');
    paint(best);
  };
  const release = () => { held = false; visitChart.classList.remove('is-scrubbing'); };
  visitChart.addEventListener('pointermove', event => { if (!held && event.pointerType === 'touch') return; held = true; fromClient(event.clientX); });
  visitChart.addEventListener('pointerdown', event => { held = true; visitChart.setPointerCapture?.(event.pointerId); fromClient(event.clientX); });
  visitChart.addEventListener('pointerleave', release);
  visitChart.addEventListener('pointerup', release);
  visitChart.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    held = true;
    visitChart.classList.add('is-scrubbing');
    if (event.key === 'Home') paint(0);
    else if (event.key === 'End') paint(points.length - 1);
    else paint(index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  visitChart.addEventListener('blur', release);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paint(0);
    window.setInterval(() => { if (!held) paint((index + 1) % points.length); }, 1100);
  }
}

for (const funnel of document.querySelectorAll('.spec-funnel')) {
  const stages = [...funnel.querySelectorAll('.funnel-stage')];
  const mark = button => {
    const stage = Number(button.dataset.stage);
    stages.forEach((shape, i) => { shape.classList.toggle('is-hot', i === stage); shape.classList.toggle('is-dim', i !== stage); });
  };
  const clear = () => stages.forEach(shape => shape.classList.remove('is-hot', 'is-dim'));
  for (const button of funnel.querySelectorAll('button')) {
    button.addEventListener('pointerenter', () => mark(button));
    button.addEventListener('focus', () => mark(button));
    button.addEventListener('pointerleave', clear);
    button.addEventListener('blur', clear);
  }
}

for (const book of document.querySelectorAll('.spec-book')) {
  const value = book.querySelector('.spec-head strong');
  const delta = book.querySelector('.spec-delta');
  const summary = { value: value.textContent, delta: delta.textContent };
  for (const row of book.querySelectorAll('.spec-row')) {
    const show = () => {
      book.querySelectorAll('.spec-row').forEach(other => other.classList.toggle('is-hot', other === row));
      value.textContent = row.dataset.amount;
      delta.textContent = row.dataset.share;
    };
    const hide = () => {
      row.classList.remove('is-hot');
      value.textContent = summary.value;
      delta.textContent = summary.delta;
    };
    row.addEventListener('pointerenter', show);
    row.addEventListener('focus', show);
    row.addEventListener('pointerleave', hide);
    row.addEventListener('blur', hide);
  }
}
