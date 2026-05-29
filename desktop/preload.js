'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('symbolic', {
  platform: process.platform,
  onOpenTab: (callback) => {
    ipcRenderer.on('open-tab', (_event, url) => callback(url));
  },
  openExternal: (url) => {
    ipcRenderer.send('open-external', url);
  },
});
