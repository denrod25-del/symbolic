'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('symbolic', {
  platform: process.platform,
  onOpenTab: (callback) => {
    ipcRenderer.on('open-tab', (_event, url) => callback(url));
  },
  onShortcut: (callback) => {
    ipcRenderer.on('shortcut', (_event, payload) => callback(payload));
  },
  onDownload: (callback) => {
    ipcRenderer.on('download', (_event, payload) => callback(payload));
  },
  openExternal: (url) => {
    ipcRenderer.send('open-external', url);
  },
  saveScreenshot: (dataUrl) => {
    ipcRenderer.send('save-screenshot', dataUrl);
  },
  openDownload: (filePath) => {
    ipcRenderer.send('open-download', filePath);
  },
  showDownload: (filePath) => {
    ipcRenderer.send('show-download', filePath);
  },
});
