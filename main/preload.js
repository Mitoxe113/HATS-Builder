'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  init: () => ipcRenderer.invoke('app:init'),
  saveSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  checkReleases: (force = false) => ipcRenderer.invoke('releases:check', { force }),
  previewHekateIni: (config) => ipcRenderer.invoke('hekate:preview', config),
  chooseOutputDir: () => ipcRenderer.invoke('pack:chooseOutput'),
  buildPack: (args) => ipcRenderer.invoke('pack:build', args),
  cancelBuild: () => ipcRenderer.invoke('pack:cancel'),
  packInfo: (dir) => ipcRenderer.invoke('pack:info', dir),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  listDrives: () => ipcRenderer.invoke('sd:list'),
  previewCopy: (args) => ipcRenderer.invoke('sd:preview', args),
  copyToDrive: (args) => ipcRenderer.invoke('sd:copy', args),
  cancelCopy: () => ipcRenderer.invoke('sd:cancel'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (dir) => ipcRenderer.invoke('shell:openPath', dir),
  checkUpdate: (force = false) => ipcRenderer.invoke('update:check', { force }),
  downloadUpdate: (asset) => ipcRenderer.invoke('update:download', asset),
  revealFile: (file) => ipcRenderer.invoke('update:reveal', file),
  installUpdate: (file) => ipcRenderer.invoke('update:install', file),
  onProgress: (callback) => {
    ipcRenderer.on('progress', (_e, event) => callback(event));
  },
});
