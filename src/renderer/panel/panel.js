// The list under the menu bar icon. For now only its frame: the heading,
// the empty state and the footer.
const api = window.shotdrawer;
const panel = document.getElementById('panel');

// The window takes the page's height.
new ResizeObserver(() => api.setHeight(panel.offsetHeight)).observe(panel);

document.getElementById('quit').addEventListener('click', () => api.quit());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.hide();
});
