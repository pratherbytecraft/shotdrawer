// Shotdrawer's menu bar icon. A click opens the list, a right click (or a
// Control click) shows the short menu. The glyph is a template image built
// from design/tray.svg, so macOS tints it for the light or dark menu bar.
import { Tray, Menu, nativeImage, type Rectangle } from 'electron';
import path from 'path';

export interface Actions {
  toggle: () => void;
  settings: () => void;
  quit: () => void;
}

let tray: Tray | null = null;
let given: Actions | null = null; // the actions, for making the icon again

function glyph() {
  // Picks up trayTemplate@2x.png on its own for Retina screens.
  const image = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  image.setTemplateImage(true);
  return image;
}

export function create(actions: Actions) {
  given = actions;
  const icon = new Tray(glyph());
  tray = icon;
  icon.setToolTip('Shotdrawer');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Shotdrawer Settings…', click: actions.settings },
    { type: 'separator' },
    { label: 'Quit Shotdrawer', click: actions.quit }
  ]);
  icon.on('click', (e) => {
    if (e.ctrlKey) icon.popUpContextMenu(menu());
    else actions.toggle();
  });
  icon.on('right-click', () => icon.popUpContextMenu(menu()));
  return icon;
}

// Takes the icon out of the menu bar or puts it back. macOS has no way to
// hide a menu bar icon, so it's removed and made again.
export function show(on: boolean) {
  if (on && !tray && given) create(given);
  if (!on && tray) {
    tray.destroy();
    tray = null;
  }
}

// Where the icon sits on screen, for placing the list under it, or null
// while it's out of the menu bar.
export function bounds(): Rectangle | null {
  return tray ? tray.getBounds() : null;
}
