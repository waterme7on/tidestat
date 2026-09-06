const demoFrame = document.querySelector('.demo-shell iframe');
if (demoFrame) {
  demoFrame.addEventListener('error', () => {
    document.querySelector('.demo-fallback').hidden = false;
  });
}
