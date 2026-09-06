const links = [...document.querySelectorAll('nav a[data-page]')];
const pages = [...document.querySelectorAll('article[data-page]')];
const sidebar = document.querySelector('.sidebar');
const menu = document.querySelector('.menu');
function showPage() {
  const requested = location.hash.slice(1) || 'start';
  if (requested === 'content') return;
  const selected = pages.find(page => page.dataset.page === requested) || pages[0];
  pages.forEach(page => { page.hidden = page !== selected; });
  links.forEach(link => { if (link.dataset.page === selected.dataset.page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  document.title = selected.querySelector('h1').textContent + ' · TideStat Docs';
  sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showPage);
menu.addEventListener('click', () => { const open = sidebar.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
document.querySelector('.search').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  links.forEach(link => { const page = pages.find(p => p.dataset.page === link.dataset.page); link.hidden = !page.textContent.toLowerCase().includes(query); });
  document.querySelectorAll('.nav-group').forEach(group => { group.hidden = ![...group.nextElementSibling.querySelectorAll('a')].some(a => !a.hidden); });
  document.querySelector('.empty').hidden = links.some(link => !link.hidden);
});
document.querySelectorAll('pre').forEach(pre => {
  const wrap = document.createElement('div'); wrap.className = 'code-wrap'; pre.before(wrap); wrap.append(pre);
  const button = document.createElement('button'); button.className = 'copy'; button.type = 'button'; button.textContent = 'Copy'; button.setAttribute('aria-label', 'Copy code example');
  button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); button.textContent = 'Copied'; } catch { button.textContent = 'Select to copy'; const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(pre); selection.removeAllRanges(); selection.addRange(range); } setTimeout(() => { button.textContent = 'Copy'; }, 2000); }); wrap.append(button);
});
showPage();
