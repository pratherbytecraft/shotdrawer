// The list under the menu bar icon. For now only its frame: the heading
// with the count, the empty state and the footer.
const api = window.shotdrawer;
const panel = document.getElementById('panel');

function render(state) {
  const n = state.shots.length;
  document.getElementById('count').hidden = n === 0;
  document.getElementById('count').textContent = n;
  document.getElementById('empty').hidden = n > 0;
}

api.getState().then(render);
api.onState(render);

// The window takes the page's height.
new ResizeObserver(() => api.setHeight(panel.offsetHeight)).observe(panel);

document.getElementById('quit').addEventListener('click', () => api.quit());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.hide();
});
