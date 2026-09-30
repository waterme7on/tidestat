const bound = new WeakSet();

function paintPlot(plot, index) {
  const svg = plot.querySelector('svg');
  const points = JSON.parse(svg.dataset.points);
  const i = Math.max(0, Math.min(points.length - 1, index));
  const point = points[i];
  plot.querySelector('[data-tide-label]').textContent = point.label;
  plot.querySelector('[data-tide-value]').textContent = point.value;
  plot.querySelector('.tide-cursor')?.setAttribute('cx', point.x);
  plot.querySelector('.tide-cursor')?.setAttribute('cy', point.y);
  plot.querySelector('.tide-cross')?.setAttribute('x1', point.x);
  plot.querySelector('.tide-cross')?.setAttribute('x2', point.x);
  plot.dataset.index = String(i);
  plot.setAttribute('aria-valuenow', String(i));
  plot.setAttribute('aria-valuetext', `${point.label} ${point.value}`);
}

function bindPlot(plot) {
  if (bound.has(plot)) return;
  bound.add(plot);
  const svg = plot.querySelector('svg');
  const points = JSON.parse(svg.dataset.points);
  let index = points.length - 1;
  const fromClient = clientX => {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 920;
    let best = 0;
    points.forEach((point, i) => { if (Math.abs(point.x - x) < Math.abs(points[best].x - x)) best = i; });
    index = best;
    paintPlot(plot, index);
  };
  plot.addEventListener('pointermove', event => { if (event.pointerType === 'touch' && !plot.hasPointerCapture?.(event.pointerId)) return; fromClient(event.clientX); });
  plot.addEventListener('pointerdown', event => { plot.setPointerCapture?.(event.pointerId); fromClient(event.clientX); });
  plot.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = points.length - 1;
    else index += event.key === 'ArrowRight' ? 1 : -1;
    paintPlot(plot, index);
  });
}

function bindRank(row) {
  if (bound.has(row)) return;
  bound.add(row);
  const on = () => row.classList.add('is-hot');
  const off = () => row.classList.remove('is-hot');
  row.addEventListener('pointerenter', on);
  row.addEventListener('focus', on);
  row.addEventListener('pointerleave', off);
  row.addEventListener('blur', off);
}

function bindHeat(heat) {
  if (bound.has(heat)) return;
  bound.add(heat);
  const svg = heat.querySelector('svg');
  const readout = heat.querySelector('[data-tide-value]');
  const label = heat.querySelector('[data-tide-label]');
  const cells = [...svg.querySelectorAll('[data-heat]')];
  const show = cell => {
    cells.forEach(other => other.classList.toggle('is-hot', other === cell));
    label.textContent = cell.dataset.day;
    readout.textContent = `${String(cell.dataset.hour).padStart(2, '0')}:00 · ${cell.dataset.heat}`;
  };
  svg.addEventListener('pointermove', event => {
    const hit = event.target.closest('[data-heat]');
    if (hit) show(hit);
  });
  heat.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = svg.querySelector('.is-hot') || cells[0];
    const index = Math.max(0, cells.indexOf(current));
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -24 : 24;
    show(cells[Math.max(0, Math.min(cells.length - 1, index + step))]);
  });
}

function bindDonut(donut) {
  if (bound.has(donut)) return;
  bound.add(donut);
  const strong = donut.querySelector('strong');
  const note = donut.querySelector('span');
  if (!strong || !note) return;
  const share = donut.dataset.share || '0';
  const rest = String(Math.max(0, 100 - Number(share)));
  const original = { value: strong.innerHTML, note: note.textContent };
  const show = (value, text) => { strong.textContent = value; note.textContent = text; };
  donut.addEventListener('pointerenter', () => show(`${rest}%`, 'First observed visit'));
  donut.addEventListener('pointerleave', () => { strong.innerHTML = original.value; note.textContent = original.note; });
  donut.addEventListener('focusin', () => show(`${share}%`, 'Returning visitors'));
  donut.addEventListener('focusout', () => { strong.innerHTML = original.value; note.textContent = original.note; });
}

export function bindCharts(root = document) {
  root.querySelectorAll('[data-tide-plot]').forEach(bindPlot);
  root.querySelectorAll('[data-tide-rank]').forEach(bindRank);
  root.querySelectorAll('[data-tide-heat]').forEach(bindHeat);
  root.querySelectorAll('[data-tide-donut]').forEach(bindDonut);
}

bindCharts();
new MutationObserver(() => bindCharts()).observe(document.documentElement, { childList: true, subtree: true });
