const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFileAs: (defaultPath) => ipcRenderer.invoke('dialog:saveFileAs', defaultPath),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  createInDir: (parentDir, fileName) => ipcRenderer.invoke('file:create-in-dir', parentDir, fileName),
  createDir: (parentDir, folderName) => ipcRenderer.invoke('dir:create', parentDir, folderName),
  deleteItem: (itemPath) => ipcRenderer.invoke('file:delete', itemPath),
  renameItem: (oldPath, newName) => ipcRenderer.invoke('file:rename', oldPath, newName),
  moveItem: (srcPath, destDir) => ipcRenderer.invoke('file:move', srcPath, destDir),
  listMarkdown: (dirPath) => ipcRenderer.invoke('dir:listMarkdown', dirPath),
  exportPdf: (htmlContent, defaultPath) => ipcRenderer.invoke('export:pdf', htmlContent, defaultPath),
  exportHtml: (htmlContent, defaultPath) => ipcRenderer.invoke('export:html', htmlContent, defaultPath),
  
  // Custom Window Controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close')
});
