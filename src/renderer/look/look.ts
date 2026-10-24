// The big look: one screenshot, its name and size. Main sizes the window to
// the picture and sends what to show.
import type { Look } from '../../shared/types';

const api = window.shotdrawer;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Finder's way: 1000 bytes to a KB.
function bytesOf(n: number) {
  if (n < 1000) return `${n} bytes`;
  if (n < 1000 * 1000) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1000 / 1000).toFixed(1)} MB`;
}

api.onLook((look: Look) => {
  $<HTMLImageElement>('pic').src = look.src;
  $('name').textContent = look.name;
  const parts = [];
  if (look.size) parts.push(`${look.size.width} × ${look.size.height}`);
  parts.push(bytesOf(look.bytes));
  $('meta').textContent = parts.join(' · ');
  $('hint').hidden = !look.hint;
});
