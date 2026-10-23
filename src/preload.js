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
  clearHistory: () => ipcRenderer.send('history:clear'),
  folderMenu: () => ipcRenderer.send('folder:menu'),
  openPrivacy: () => ipcRenderer.send('privacy:open')
});
