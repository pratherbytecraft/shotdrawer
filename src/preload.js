const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const handler = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('shotdrawer', {
  getState: () => ipcRenderer.invoke('state'),
  onShown: on('panel:shown'),
  setHeight: (h) => ipcRenderer.send('panel:height', h),
  hide: () => ipcRenderer.send('panel:hide'),
  quit: () => ipcRenderer.send('app:quit')
});
