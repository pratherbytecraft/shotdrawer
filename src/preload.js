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
  clearHistory: () => ipcRenderer.send('history:clear'),
  folderMenu: () => ipcRenderer.send('folder:menu'),
  openPrivacy: () => ipcRenderer.send('privacy:open')
});
