'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  init: () => ipcRenderer.invoke('app:init'),
  saveSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  checkReleases: (force = false) => ipcRenderer.invoke('releases:check', { force }),
  previewHekateIni: (config) => ipcRenderer.invoke('hekate:preview', config),
  chooseOutputDir: () => ipcRenderer.invoke('pack:chooseOutput'),
  buildPack: (args) => ipcRenderer.invoke('pack:build', args),
  packInfo: (dir) => ipcRenderer.invoke('pack:info', dir),
  listDrives: () => ipcRenderer.invoke('sd:list'),
  copyToDrive: (args) => ipcRenderer.invoke('sd:copy', args),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (dir) => ipcRenderer.invoke('shell:openPath', dir),
  onProgress: (callback) => {
    ipcRenderer.on('progress', (_e, event) => callback(event));
  },
});
