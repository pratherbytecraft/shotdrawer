// The shotdrawer:// link other apps open to show the list, registered in
// Shotdrawer.app's Info.plist by scripts/build-app.ts. Startbar's tray
// button opens shotdrawer://show?x=1240&y=820&edge=bottom with the top
// center of the button in screen points, and the list opens just above it.
// Without a spot, the list opens under the menu bar icon.

export interface Spot {
  x: number;
  y: number;
  edge: 'top' | 'bottom';
}

// { action: 'show', spot } for a link Shotdrawer knows, else null.
export function parse(url: string): { action: 'show'; spot: Spot | null } | null {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'shotdrawer:') return null;
  const action = (u.hostname || u.pathname.replace(/^\/+/, '')).toLowerCase();
  if (action !== 'show') return null;
  const raw = [u.searchParams.get('x'), u.searchParams.get('y')];
  const [x, y] = raw.map((v) => (v === null || v.trim() === '' ? NaN : Number(v)));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { action, spot: null };
  const edge = u.searchParams.get('edge') === 'top' ? 'top' : 'bottom';
  return { action, spot: { x: Math.round(x), y: Math.round(y), edge } };
}
