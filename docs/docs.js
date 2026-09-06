import { tr, locale } from '../product-ui.js';
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
  updateTitle(selected);
  sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
}
function updateTitle(selected = pages.find(page => !page.hidden)) {
  if (selected) document.title = tr(selected.dataset.docTitle) + ' · ' + tr('TideStat Docs');
}
window.addEventListener('hashchange', showPage);
menu.addEventListener('click', () => { const open = sidebar.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
function filterPages() {
  const query = document.querySelector('.search').value.trim().toLocaleLowerCase(locale());
  links.forEach(link => { const page = pages.find(p => p.dataset.page === link.dataset.page); link.hidden = !page.textContent.toLocaleLowerCase(locale()).includes(query); });
  document.querySelectorAll('.nav-group').forEach(group => { group.hidden = ![...group.nextElementSibling.querySelectorAll('a')].some(a => !a.hidden); });
  document.querySelector('.empty').hidden = links.some(link => !link.hidden);
}
document.querySelector('.search').addEventListener('input', filterPages);
window.addEventListener('tide:languagechange', () => { updateTitle(); filterPages(); document.querySelectorAll('.copy').forEach(button => { button.textContent = tr('Copy'); button.setAttribute('aria-label', tr('Copy code example')); }); });
document.querySelectorAll('pre').forEach(pre => {
  const wrap = document.createElement('div'); wrap.className = 'code-wrap'; pre.before(wrap); wrap.append(pre);
  const button = document.createElement('button'); button.className = 'copy'; button.type = 'button'; button.setAttribute('data-no-translate', ''); button.textContent = tr('Copy'); button.setAttribute('aria-label', tr('Copy code example'));
  button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); button.textContent = tr('Copied'); } catch { button.textContent = tr('Select to copy'); const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(pre); selection.removeAllRanges(); selection.addRange(range); } setTimeout(() => { button.textContent = tr('Copy'); }, 2000); }); wrap.append(button);
});
showPage();
