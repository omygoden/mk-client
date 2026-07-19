const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const OPENABLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

// Keep Electron's default hardware acceleration enabled. Disabling the GPU
// forces Chromium to paint and composite scrolling on the CPU, which makes
// high-refresh-rate displays feel substantially less smooth.

// Apply command line switches that do not disable GPU rendering/compositing.
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-device-discovery-notifications');

// Additional startup acceleration switches
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,TranslateUI');
app.commandLine.appendSwitch('disable-spell-checking');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('v8-cache-options', 'code');  // Enable V8 code caching for faster JS parse
app.commandLine.appendSwitch('js-flags', '--optimize-for-size --max-old-space-size=512');

let mainWindow;
let pendingOpenFilePath = getOpenableFilePathFromArgs(process.argv);

function getOpenableFilePathFromArgs(args) {
  return args.find((arg) => getOpenableFilePath(arg)) || null;
}

function getOpenableFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const ext = path.extname(filePath).toLowerCase();
  if (!OPENABLE_EXTENSIONS.has(ext)) return null;
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    return filePath;
  } catch {
    return null;
  }
}

function readOpenableFile(filePath) {
  const safePath = getOpenableFilePath(filePath);
  if (!safePath) return null;
  return {
    filePath: safePath,
    content: fs.readFileSync(safePath, 'utf-8'),
    fileName: path.basename(safePath)
  };
}

function sendOpenFileToRenderer(filePath) {
  const fileData = readOpenableFile(filePath);
  if (!fileData || !mainWindow) return false;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('file:openExternal', fileData);
  return true;
}

function flushPendingOpenFile() {
  if (!pendingOpenFilePath) return;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  sendOpenFileToRenderer(filePath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // Defer show until content is painted to avoid blank window flash
    backgroundColor: '#12121e', // Set default background to dark to prevent any white flash
    titleBarStyle: 'hidden', // Custom frameless title bar for premium look
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,           // Skip spell-checker init (~100ms)
      enableWebSQL: false,         // Disable unused WebSQL
      backgroundThrottling: false  // Keep renderer at full speed
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Show window as soon as the renderer paints its first frame
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the main HTML file
  mainWindow.loadFile('index.html');
  mainWindow.webContents.once('did-finish-load', flushPendingOpenFile);

  // Toggle DevTools with Ctrl+Shift+I, Cmd+Alt+I, or F12
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isToggleDevTools = 
      (input.control && input.shift && input.key.toLowerCase() === 'i') || 
      (input.meta && input.alt && input.key.toLowerCase() === 'i') ||
      (input.key === 'F12');

    if (isToggleDevTools && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const openableFilePath = getOpenableFilePath(filePath);
  if (!openableFilePath) return;

  if (mainWindow && !mainWindow.webContents.isLoading()) {
    sendOpenFileToRenderer(openableFilePath);
  } else {
    pendingOpenFilePath = openableFilePath;
  }
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const filePath = getOpenableFilePathFromArgs(commandLine);
    if (filePath && mainWindow && !mainWindow.webContents.isLoading()) {
      sendOpenFileToRenderer(filePath);
    } else if (filePath) {
      pendingOpenFilePath = filePath;
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow();

    // Defer non-critical IPC handler registration to after window creation
    // This lets the window appear ~50-100ms faster
    setImmediate(() => {
      registerDeferredIPCHandlers();
    });

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Critical IPC handlers needed immediately at startup (window controls)
// These must be registered before the window shows
ipcMain.on('window:minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow.close();
});

// Deferred IPC handlers - registered after window creation for faster startup
function registerDeferredIPCHandlers() {

// IPC Handler: Open File Dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content, fileName: path.basename(filePath) };
});

// IPC Handler: Open Folder Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const dirPath = result.filePaths[0];
  return { dirPath, dirName: path.basename(dirPath) };
});

// IPC Handler: Save File Dialog (for Save As)
ipcMain.handle('dialog:saveFileAs', async (event, defaultPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'Untitled.md',
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  return result.filePath;
});

// IPC Handler: Read File
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, fileName: path.basename(filePath) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Write File
ipcMain.handle('file:write', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Create File in specific Directory
ipcMain.handle('file:create-in-dir', async (event, parentDir, fileName) => {
  try {
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
      return { success: false, error: 'Target folder no longer exists' };
    }
    const fullPath = path.join(parentDir, fileName);
    if (fs.existsSync(fullPath)) {
      return { success: false, error: 'File already exists' };
    }
    fs.writeFileSync(fullPath, '', 'utf-8');
    return { success: true, filePath: fullPath, fileName: path.basename(fullPath) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Create Folder
ipcMain.handle('dir:create', async (event, parentDir, folderName) => {
  try {
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
      return { success: false, error: 'Target folder no longer exists' };
    }
    const fullPath = path.join(parentDir, folderName);
    if (fs.existsSync(fullPath)) {
      return { success: false, error: 'Folder already exists' };
    }
    fs.mkdirSync(fullPath, { recursive: true });
    return { success: true, dirPath: fullPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Delete File/Folder
ipcMain.handle('file:delete', async (event, itemPath) => {
  try {
    if (fs.statSync(itemPath).isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Rename File/Folder
ipcMain.handle('file:rename', async (event, oldPath, newName) => {
  try {
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);
    if (fs.existsSync(newPath)) {
      return { success: false, error: 'Target name already exists' };
    }
    fs.renameSync(oldPath, newPath);
    return { success: true, newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Move File/Folder
ipcMain.handle('file:move', async (event, srcPath, destDir) => {
  try {
    const fileName = path.basename(srcPath);
    const destPath = path.join(destDir, fileName);
    if (fs.existsSync(destPath)) {
      return { success: false, error: 'Target file already exists in destination' };
    }
    fs.renameSync(srcPath, destPath);
    return { success: true, newPath: destPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Move multiple files/folders
ipcMain.handle('file:moveMany', async (event, srcPaths, destDir) => {
  try {
    if (!Array.isArray(srcPaths) || srcPaths.length === 0) {
      return { success: false, error: 'No items selected' };
    }
    if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) {
      return { success: false, error: 'Target folder no longer exists' };
    }

    const normalizedDest = path.resolve(destDir);
    const uniqueSrcPaths = [...new Set(srcPaths)].map((srcPath) => path.resolve(srcPath));
    const moved = [];
    const errors = [];

    for (const srcPath of uniqueSrcPaths) {
      try {
        if (!fs.existsSync(srcPath)) {
          errors.push({ path: srcPath, error: 'Source item no longer exists' });
          continue;
        }

        const sourceStat = fs.statSync(srcPath);
        if (sourceStat.isDirectory()) {
          const relativeDest = path.relative(srcPath, normalizedDest);
          if (relativeDest === '' || (!relativeDest.startsWith('..') && !path.isAbsolute(relativeDest))) {
            errors.push({ path: srcPath, error: 'Cannot move a folder into itself' });
            continue;
          }
        }

        const fileName = path.basename(srcPath);
        const destPath = path.join(normalizedDest, fileName);
        if (path.resolve(path.dirname(srcPath)) === normalizedDest) {
          errors.push({ path: srcPath, error: 'Item is already in this folder' });
          continue;
        }
        if (fs.existsSync(destPath)) {
          errors.push({ path: srcPath, error: 'Target item already exists in destination' });
          continue;
        }

        fs.renameSync(srcPath, destPath);
        moved.push({ oldPath: srcPath, newPath: destPath });
      } catch (error) {
        errors.push({ path: srcPath, error: error.message });
      }
    }

    return { success: errors.length === 0, moved, errors };
  } catch (error) {
    return { success: false, error: error.message, moved: [], errors: [] };
  }
});

// IPC Handler: Reveal file/folder in OS file manager
ipcMain.handle('shell:showItemInFolder', async (event, itemPath) => {
  try {
    if (!itemPath || !fs.existsSync(itemPath)) {
      return { success: false, error: 'Item no longer exists' };
    }
    shell.showItemInFolder(itemPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Scan Directory for Markdown files
ipcMain.handle('dir:listMarkdown', async (event, dirPath) => {
  try {
    const listFiles = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      list.forEach((file) => {
        const fullPath = path.join(dir, file.name);
        try {
          const stat = fs.statSync(fullPath);
          if (file.isDirectory()) {
            // Ignore node_modules, .git, etc.
            if (file.name !== 'node_modules' && file.name !== '.git' && file.name !== 'dist') {
              results.push({
                name: file.name,
                path: fullPath,
                isDirectory: true,
                birthtime: stat.birthtimeMs,
                mtime: stat.mtimeMs,
                size: stat.size,
                children: listFiles(fullPath)
              });
            }
          } else {
            const ext = path.extname(file.name).toLowerCase();
            if (['.md', '.markdown', '.txt'].includes(ext)) {
              results.push({
                name: file.name,
                path: fullPath,
                isDirectory: false,
                isEmpty: stat.size === 0,
                birthtime: stat.birthtimeMs,
                mtime: stat.mtimeMs,
                size: stat.size
              });
            }
          }
        } catch (err) {
          console.error(`Error reading stats for ${fullPath}:`, err);
        }
      });
      // Sort: Directories first, then files alphabetically by default
      return results.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    };

    const files = listFiles(dirPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Export to PDF
ipcMain.handle('export:pdf', async (event, htmlContent, defaultPath) => {
  try {
    // Show save dialog for PDF
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || 'document.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // We create a hidden browser window to print the HTML content to PDF
    const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    
    // We construct a simple styled HTML document for exporting
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-top: 24px; margin-bottom: 16px; line-height: 1.25; }
          h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
          h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
          h3 { font-size: 1.25em; }
          p, blockquote, ul, ol, dl, table, pre { margin-top: 0; margin-bottom: 16px; }
          code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 85%; background-color: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; }
          pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #f6f8fa; border-radius: 3px; }
          pre code { background-color: transparent; padding: 0; }
          blockquote { padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
          table th, table td { border: 1px solid #dfe2e5; padding: 6px 13px; }
          table tr:nth-child(even) { background-color: #f6f8fa; }
          img { max-width: 100%; box-sizing: content-box; }
          a { color: #0366d6; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    
    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      marginsType: 1, // Minimum margins
      pageSize: 'A4'
    });

    fs.writeFileSync(result.filePath, pdfData);
    printWindow.destroy();

    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Export to HTML
ipcMain.handle('export:html', async (event, htmlContent, defaultPath) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || 'document.html',
      filters: [{ name: 'HTML Files', extensions: ['html'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Exported Document</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            background-color: #fff;
          }
          h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-top: 24px; margin-bottom: 16px; line-height: 1.25; }
          h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
          h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
          h3 { font-size: 1.25em; }
          p, blockquote, ul, ol, dl, table, pre { margin-top: 0; margin-bottom: 16px; }
          code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 85%; background-color: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; }
          pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #f6f8fa; border-radius: 3px; }
          pre code { background-color: transparent; padding: 0; }
          blockquote { padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
          table th, table td { border: 1px solid #dfe2e5; padding: 6px 13px; }
          table tr:nth-child(even) { background-color: #f6f8fa; }
          img { max-width: 100%; box-sizing: content-box; }
          a { color: #0366d6; text-decoration: none; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    fs.writeFileSync(result.filePath, fullHtml, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

} // end registerDeferredIPCHandlers
