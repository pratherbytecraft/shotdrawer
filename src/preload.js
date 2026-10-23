const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const handler = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('shotdrawer', {
  getState: () => ipcRenderer.invoke('state'),
  onState: on('state'),
  onShown: on('panel:shown'),
  setHeight: (h) => ipcRenderer.send('panel:height', h),
  hide: () => ipcRenderer.send('panel:hide'),
  quit: () => ipcRenderer.send('app:quit'),
  details: (files) => ipcRenderer.invoke('shots:details', files),
  copy: (file) => ipcRenderer.send('shot:copy', file),
  copyMany: (files) => ipcRenderer.send('shots:copy', files),
  show: (file) => ipcRenderer.send('shot:show', file),
  menu: (file, picked) => ipcRenderer.send('shot:menu', file, picked),
  drag: (files, picture) => ipcRenderer.send('shots:drag', files, picture),
  onCopied: on('copied'),
  openSettings: (page) => ipcRenderer.send('settings:open', page),
  onSettingsPage: on('settings:page'),
  set: (patch) => ipcRenderer.send('settings:set', patch),
  setLoginItem: (on) => ipcRenderer.send('login:set', on),
  checkUpdates: () => ipcRenderer.send('updates:check'),
  copyText: (text) => ipcRenderer.send('text:copy', text),
  openLink: (key) => ipcRenderer.send('link:open', key),
  openSibling: (key) => ipcRenderer.send('sibling:open', key),
  showFolder: () => ipcRenderer.send('folder:show'),
  changeFolder: () => ipcRenderer.send('folder:change'),
  clearHistory: () => ipcRenderer.send('history:clear'),
  unremove: (files) => ipcRenderer.send('history:unremove', files),
  onRemoved: on('removed'),
  folderMenu: () => ipcRenderer.send('folder:menu'),
  openPrivacy: () => ipcRenderer.send('privacy:open')
});
