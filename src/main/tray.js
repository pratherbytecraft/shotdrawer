// Shotdrawer's menu bar icon. A click opens the list, a right click (or a
// Control click) shows the short menu. The glyph is a template image built
// from design/tray.svg, so macOS tints it for the light or dark menu bar.
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function glyph() {
  // Picks up trayTemplate@2x.png on its own for Retina screens.
  const image = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  image.setTemplateImage(true);
  return image;
}

// actions: { toggle, quit }
function create(actions) {
  tray = new Tray(glyph());
  tray.setToolTip('Shotdrawer');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Quit Shotdrawer', click: actions.quit }
  ]);
  tray.on('click', (e) => {
    if (e.ctrlKey) tray.popUpContextMenu(menu());
    else actions.toggle();
  });
  tray.on('right-click', () => tray.popUpContextMenu(menu()));
  return tray;
}

// Where the icon sits on screen, for placing the list under it.
function bounds() {
  return tray ? tray.getBounds() : null;
}

module.exports = { create, bounds };
