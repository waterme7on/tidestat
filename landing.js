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
