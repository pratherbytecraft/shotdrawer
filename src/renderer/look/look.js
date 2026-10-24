// The big look: one screenshot, its name and size. Main sizes the window to
// the picture and sends what to show.
const api = window.shotdrawer;

// Finder's way: 1000 bytes to a KB.
function bytesOf(n) {
  if (n < 1000) return `${n} bytes`;
  if (n < 1000 * 1000) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1000 / 1000).toFixed(1)} MB`;
}

api.onLook((look) => {
  document.getElementById('pic').src = look.src;
  document.getElementById('name').textContent = look.name;
  const parts = [];
  if (look.size) parts.push(`${look.size.width} × ${look.size.height}`);
  parts.push(bytesOf(look.bytes));
  document.getElementById('meta').textContent = parts.join(' · ');
  document.getElementById('hint').hidden = !look.hint;
});
