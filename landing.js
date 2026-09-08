const demoFrame = document.querySelector('.demo-shell iframe');
if (demoFrame) {
  demoFrame.addEventListener('error', () => {
    document.querySelector('.demo-fallback').hidden = false;
  });
}

const demoOpen = document.getElementById('demoOpenLink');
const demoViews = { live: { src: './live.html?demo=1&embed=1', open: './live.html?demo=1' }, revenue: { src: './revenue.html?demo=1&embed=1', open: './revenue.html?demo=1' } };
for (const tab of document.querySelectorAll('.demo-tab')) tab.addEventListener('click', () => {
  const view = demoViews[tab.dataset.demo]; if (!view || tab.classList.contains('active')) return;
  for (const other of document.querySelectorAll('.demo-tab')) { other.classList.toggle('active', other === tab); other.setAttribute('aria-selected', String(other === tab)); }
  demoFrame.src = view.src; demoOpen.href = view.open;
  for (const hint of document.querySelectorAll('[data-demo-hint]')) hint.hidden = hint.dataset.demoHint !== tab.dataset.demo;
});
