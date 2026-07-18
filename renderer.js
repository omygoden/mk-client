// Core Editor State
let currentFilePath = null;
let originalContent = '';
let isModified = false;
let currentViewMode = 'live'; // 'edit', 'split', 'preview', 'live'
let openDirectories = new Set(); // To keep track of expanded directories in sidebar
let sidebarFilesData = [];

// DOM element references - lazily initialized on DOMContentLoaded to avoid
// blocking script parse with 30+ synchronous getElementById calls
let bodyElement, themeDropdown, btnZoomIn, btnZoomOut, btnZoomReset, zoomLevel;
let markdownTextarea, previewContainer, previewContent, editorContainer;
let liveScrollControls, liveHeadingNav, btnScrollTop, btnScrollBottom;
let currentFilename, unsavedIndicator, dirTree, outlineView, currentFilepathStatus, paneSortContainer, sortDropdown, btnRefreshSidebar;
let appSidebar, sidebarExpandHandle, btnToggleSidebar, tabFiles, tabOutline, paneFiles, paneOutline;
let btnNewFile, btnOpenFile, btnSaveFile, btnModeEdit, btnModeSplit, btnModePreview, btnModeLive, btnExportPdf, btnExportHtml;
let btnRecent, recentMenu, recentList, btnClearRecent;
let contextMenu, ctxRefreshSidebar, ctxOpenItem, ctxShowInFolder, ctxCopyPath, ctxCreateFile, ctxCreateFolder, ctxRenameItem, ctxDeleteItem;
let selectedPathForContextMenu = null;
let selectedIsDir = false;
let selectedFileTreePaths = new Set();
let lastSelectedFilePath = null;
let visibleFilePaths = [];
let inputModal, modalInputFilename, btnModalCancel, btnModalConfirm;
let unsavedModal, btnUnsavedCancel, btnUnsavedDiscard, btnUnsavedSave;
let formatBold, formatItalic, formatHeading, formatCode, formatLink, formatImage, formatTable;
let wordCountSpan, chineseCharCountSpan, charNoSpacesCountSpan, charCountSpan, readTimeSpan;
let btnMinimize, btnMaximize, btnClose;

// Find/Replace Bar
let findBar, findInput, replaceInput, findCountSpan, findCaseSensitive, findUseRegex;
let findPrevBtn, findNextBtn, findReplaceOneBtn, findReplaceAllBtn, findCloseBtn;
let findMatches = [];  // Array of {start, end} for each match
let findCurrentIndex = -1;  // Current highlighted match index
let findSearchTerm = '';    // Last searched term
let findLiveRanges = [];
let findStartOffset = 0;
let savedTextareaSelection = null;
let savedLiveSelection = null;
let tableContextCell = null;

// Cross-mode edit history. Native textarea history does not include changes
// made through toolbar/context-menu actions, so keep one document-level stack.
const undoStack = [];
const redoStack = [];
const MAX_HISTORY_ENTRIES = 200;
let isRestoringHistory = false;
const APP_ZOOM_STORAGE_KEY = 'app-zoom-percent';
const APP_ZOOM_STEP = 10;
const APP_ZOOM_MIN = 50;
const APP_ZOOM_MAX = 200;
let appZoomPercent = 100;
const RECENT_ITEMS_STORAGE_KEY = 'recent-open-items';
const MAX_RECENT_ITEMS = 12;
const EMPTY_LINE_MARKDOWN = '<p><br></p>';

// Editor right-click context menu
let editorContextMenu;

// Batch-initialize all DOM references in one pass
function initDOMReferences() {
  bodyElement = document.body;
  themeDropdown = document.getElementById('theme-dropdown');
  btnZoomIn = document.getElementById('btn-zoom-in');
  btnZoomOut = document.getElementById('btn-zoom-out');
  btnZoomReset = document.getElementById('btn-zoom-reset');
  zoomLevel = document.getElementById('zoom-level');
  markdownTextarea = document.getElementById('markdown-textarea');
  previewContainer = document.getElementById('preview-container');
  previewContent = document.getElementById('preview-content');
  liveScrollControls = document.getElementById('live-scroll-controls');
  liveHeadingNav = document.getElementById('live-heading-nav');
  btnScrollTop = document.getElementById('btn-scroll-top');
  btnScrollBottom = document.getElementById('btn-scroll-bottom');
  editorContainer = document.getElementById('editor-container');
  currentFilename = document.getElementById('current-filename');
  unsavedIndicator = document.getElementById('unsaved-indicator');
  dirTree = document.getElementById('dir-tree');
  outlineView = document.getElementById('outline-view');
  currentFilepathStatus = document.getElementById('current-filepath-status');
  paneSortContainer = document.getElementById('pane-sort-container');
  sortDropdown = document.getElementById('sort-dropdown');
  btnRefreshSidebar = document.getElementById('btn-refresh-sidebar');
  appSidebar = document.getElementById('app-sidebar');
  sidebarExpandHandle = document.getElementById('sidebar-expand-handle');
  btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  tabFiles = document.getElementById('tab-files');
  tabOutline = document.getElementById('tab-outline');
  paneFiles = document.getElementById('pane-files');
  paneOutline = document.getElementById('pane-outline');
  btnNewFile = document.getElementById('btn-new-file');
  btnOpenFile = document.getElementById('btn-open-file');
  btnRecent = document.getElementById('btn-recent');
  recentMenu = document.getElementById('recent-menu');
  recentList = document.getElementById('recent-list');
  btnClearRecent = document.getElementById('btn-clear-recent');
  btnSaveFile = document.getElementById('btn-save-file');
  btnModeEdit = document.getElementById('btn-mode-edit');
  btnModeSplit = document.getElementById('btn-mode-split');
  btnModePreview = document.getElementById('btn-mode-preview');
  btnModeLive = document.getElementById('btn-mode-live');
  btnExportPdf = document.getElementById('btn-export-pdf');
  btnExportHtml = document.getElementById('btn-export-html');
  contextMenu = document.getElementById('context-menu');
  ctxRefreshSidebar = document.getElementById('ctx-refresh-sidebar');
  ctxOpenItem = document.getElementById('ctx-open-item');
  ctxShowInFolder = document.getElementById('ctx-show-in-folder');
  ctxCopyPath = document.getElementById('ctx-copy-path');
  ctxCreateFile = document.getElementById('ctx-create-file');
  ctxCreateFolder = document.getElementById('ctx-create-folder');
  ctxRenameItem = document.getElementById('ctx-rename-item');
  ctxDeleteItem = document.getElementById('ctx-delete-item');
  inputModal = document.getElementById('input-modal');
  modalInputFilename = document.getElementById('modal-input-filename');
  btnModalCancel = document.getElementById('btn-modal-cancel');
  btnModalConfirm = document.getElementById('btn-modal-confirm');
  unsavedModal = document.getElementById('unsaved-modal');
  btnUnsavedCancel = document.getElementById('btn-unsaved-cancel');
  btnUnsavedDiscard = document.getElementById('btn-unsaved-discard');
  btnUnsavedSave = document.getElementById('btn-unsaved-save');
  formatBold = document.getElementById('format-bold');
  formatItalic = document.getElementById('format-italic');
  formatHeading = document.getElementById('format-heading');
  formatCode = document.getElementById('format-code');
  formatLink = document.getElementById('format-link');
  formatImage = document.getElementById('format-image');
  formatTable = document.getElementById('format-table');
  wordCountSpan = document.getElementById('word-count');
  chineseCharCountSpan = document.getElementById('chinese-char-count');
  charNoSpacesCountSpan = document.getElementById('char-no-spaces-count');
  charCountSpan = document.getElementById('char-count');
  readTimeSpan = document.getElementById('read-time');
  btnMinimize = document.getElementById('btn-minimize');
  btnMaximize = document.getElementById('btn-maximize');
  btnClose = document.getElementById('btn-close');
  // Find bar
  findBar = document.getElementById('find-bar');
  findInput = document.getElementById('find-input');
  replaceInput = document.getElementById('replace-input');
  findCountSpan = document.getElementById('find-count');
  findCaseSensitive = document.getElementById('find-case-sensitive');
  findUseRegex = document.getElementById('find-use-regex');
  findPrevBtn = document.getElementById('find-prev');
  findNextBtn = document.getElementById('find-next');
  findReplaceOneBtn = document.getElementById('find-replace-one');
  findReplaceAllBtn = document.getElementById('find-replace-all');
  findCloseBtn = document.getElementById('find-close');
  // Editor context menu
  editorContextMenu = document.getElementById('editor-context-menu');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Batch-resolve all DOM references first
  initDOMReferences();

  // 1. Detect OS and set appropriate titlebar class
  if (navigator.userAgent.indexOf('Mac') !== -1) {
    bodyElement.classList.add('darwin');
  }

  // 3. Load Saved Theme dropdown state (body class is already initialized by inline script)
  const savedTheme = localStorage.getItem('markdown-theme') || 'theme-dark';
  themeDropdown.value = savedTheme;

  // Load Saved Sort dropdown state
  const savedSort = localStorage.getItem('sidebar-sort-by') || 'name';
  if (sortDropdown) {
    sortDropdown.value = savedSort;
  }

  // Load saved app-wide zoom before wiring events so the UI starts at the user's preferred scale.
  applySavedAppZoom();
  renderRecentItems();

  // 4. Setup Event Listeners
  setupEventListeners();
  setupExternalFileOpenListener();
  setViewMode('live');

  // Defer Lucide icon rendering and initial markdown parse to allow layout to paint instantly
  requestAnimationFrame(() => {
    lucide.createIcons();
    // Enable CSS transitions now that first paint is done (prevents theme flicker)
    bodyElement.classList.add('loaded');
    // Defer non-critical initial work to idle time
    const idleCb = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    idleCb(() => {
      updateStats();
      if (currentViewMode !== 'live') {
        renderMarkdown();
      }
      generateOutline();
    });
  });
});

function applySavedAppZoom() {
  const savedZoom = Number.parseInt(localStorage.getItem(APP_ZOOM_STORAGE_KEY), 10);
  setAppZoom(Number.isFinite(savedZoom) ? savedZoom : 100, { persist: false });
}

function changeAppZoom(delta) {
  setAppZoom(appZoomPercent + delta);
}

function setAppZoom(percent, options = {}) {
  const { persist = true } = options;
  const normalizedPercent = Math.min(APP_ZOOM_MAX, Math.max(APP_ZOOM_MIN, Math.round(percent / APP_ZOOM_STEP) * APP_ZOOM_STEP));

  appZoomPercent = normalizedPercent;
  if (window.electronAPI && typeof window.electronAPI.setZoomFactor === 'function') {
    window.electronAPI.setZoomFactor(normalizedPercent / 100);
  }
  if (zoomLevel) {
    zoomLevel.textContent = `${normalizedPercent}%`;
  }
  if (btnZoomOut) {
    btnZoomOut.disabled = normalizedPercent <= APP_ZOOM_MIN;
  }
  if (btnZoomIn) {
    btnZoomIn.disabled = normalizedPercent >= APP_ZOOM_MAX;
  }
  if (persist) {
    localStorage.setItem(APP_ZOOM_STORAGE_KEY, String(normalizedPercent));
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // --- Theme Switcher ---
  themeDropdown.addEventListener('change', (e) => {
    const chosenTheme = e.target.value;
    bodyElement.className = 'loaded';
    if (navigator.userAgent.indexOf('Mac') !== -1) {
      bodyElement.classList.add('darwin');
    }
    bodyElement.classList.add(chosenTheme);
    localStorage.setItem('markdown-theme', chosenTheme);
  });

  // --- Window Controls ---
  if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI.minimize());
  if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI.maximize());
  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI.close());

  // --- App Zoom Controls ---
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => changeAppZoom(-APP_ZOOM_STEP));
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => changeAppZoom(APP_ZOOM_STEP));
  if (btnZoomReset) btnZoomReset.addEventListener('click', () => setAppZoom(100));

  // --- Live Edit Scroll Controls ---
  [btnScrollTop, btnScrollBottom].forEach(button => {
    if (button) button.addEventListener('mousedown', e => e.preventDefault());
  });
  if (btnScrollTop) {
    btnScrollTop.addEventListener('click', () => {
      previewContainer.scrollTo({ top: 0 });
    });
  }
  if (btnScrollBottom) {
    btnScrollBottom.addEventListener('click', () => {
      previewContainer.scrollTo({ top: previewContainer.scrollHeight });
    });
  }
  previewContainer.addEventListener('scroll', () => {
    updateLiveScrollControls();
    updateActiveLiveHeading();
    updateLiveHeadingNavPosition();
  }, { passive: true });
  window.addEventListener('resize', () => {
    updateLiveScrollControls();
    updateLiveHeadingNavPosition();
  });
  previewContainer.addEventListener('mousedown', handleEmptyLiveAreaMouseDown);

  // Debounced render for input performance
  let renderTimer = null;
  markdownTextarea.addEventListener('beforeinput', (e) => {
    if (!isRestoringHistory && !(e.inputType || '').startsWith('history')) {
      recordEditorState();
    }
  });
  markdownTextarea.addEventListener('input', () => {
    isModified = true;
    unsavedIndicator.style.display = 'inline-block';
    updateStats();
    // Debounce markdown rendering to avoid blocking on rapid typing
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderMarkdown();
      generateOutline();
    }, 80);
  });

  // Force plain-text paste to prevent rich HTML clipboard content from
  // corrupting textarea state (causing cursor loss / uneditable bug)
  markdownTextarea.addEventListener('paste', (e) => {
    e.preventDefault();
    recordEditorState();
    const plainText = (e.clipboardData || window.clipboardData).getData('text/plain');
    const start = markdownTextarea.selectionStart;
    const end = markdownTextarea.selectionEnd;
    const before = markdownTextarea.value.substring(0, start);
    const after = markdownTextarea.value.substring(end);
    markdownTextarea.value = before + plainText + after;
    // Restore cursor position after paste
    const newPos = start + plainText.length;
    markdownTextarea.selectionStart = newPos;
    markdownTextarea.selectionEnd = newPos;
    markdownTextarea.focus();
    // Trigger update
    isModified = true;
    unsavedIndicator.style.display = 'inline-block';
    updateStats();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderMarkdown();
      generateOutline();
    }, 80);
  });

  // Sidebar Tabs
  tabFiles.addEventListener('click', () => {
    tabFiles.classList.add('active');
    tabOutline.classList.remove('active');
    paneFiles.classList.add('active');
    paneOutline.classList.remove('active');
  });

  tabOutline.addEventListener('click', () => {
    tabOutline.classList.add('active');
    tabFiles.classList.remove('active');
    paneOutline.classList.add('active');
    paneFiles.classList.remove('active');
    generateOutline();
  });

  // Sidebar Collapse/Expand
  btnToggleSidebar.addEventListener('click', toggleSidebar);
  sidebarExpandHandle.addEventListener('click', toggleSidebar);

  // File Controls
  btnNewFile.addEventListener('click', newFile);
  btnOpenFile.addEventListener('click', openFile);
  btnSaveFile.addEventListener('click', saveFile);
  if (btnRecent) {
    btnRecent.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = recentMenu.classList.toggle('open');
      btnRecent.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) renderRecentItems();
    });
  }
  if (btnClearRecent) {
    btnClearRecent.addEventListener('click', (e) => {
      e.stopPropagation();
      saveRecentItems([]);
      closeRecentMenu();
    });
  }
  document.addEventListener('click', (e) => {
    if (recentMenu && !e.target.closest('.recent-dropdown')) {
      closeRecentMenu();
    }
  });

  const btnOpenFolder = document.getElementById('btn-open-folder');
  const btnOpenFolderPlaceholder = document.getElementById('btn-open-folder-placeholder');

  if (btnOpenFolder) btnOpenFolder.addEventListener('click', openFolder);
  if (btnOpenFolderPlaceholder) btnOpenFolderPlaceholder.addEventListener('click', openFolder);
  if (btnRefreshSidebar) btnRefreshSidebar.addEventListener('click', refreshSidebarDirectory);

  // Formatting Helpers
  formatBold.addEventListener('click', () => insertFormatting('**', '**'));
  formatItalic.addEventListener('click', () => insertFormatting('*', '*'));
  formatHeading.addEventListener('click', () => insertFormatting('\n## ', '\n'));
  formatCode.addEventListener('click', () => insertFormatting('\n```\n', '\n```\n'));
  formatLink.addEventListener('click', () => insertFormatting('[', '](url)'));
  formatImage.addEventListener('click', () => insertFormatting('![alt text](', ' "image title")'));
  formatTable.addEventListener('click', () => {
    const tableTemplate = '\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n| Cell 3   | Cell 4   |\n';
    insertFormatting(tableTemplate, '');
  });

  // View Mode Selectors
  btnModeEdit.addEventListener('click', () => setViewMode('edit'));
  btnModeSplit.addEventListener('click', () => setViewMode('split'));
  btnModePreview.addEventListener('click', () => setViewMode('preview'));
  btnModeLive.addEventListener('click', () => setViewMode('live'));

  // Double click preview to edit
  previewContainer.addEventListener('dblclick', () => {
    if (currentViewMode === 'preview') {
      setViewMode('edit');
    }
  });

  // Custom Context Menu on Files Pane (nodes & empty space)
  paneFiles.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const node = e.target.closest('.tree-node');
    if (node) {
      selectedPathForContextMenu = node.getAttribute('data-path');
      selectedIsDir = node.classList.contains('directory');
      if (!selectedIsDir && !selectedFileTreePaths.has(selectedPathForContextMenu)) {
        selectedFileTreePaths = new Set([selectedPathForContextMenu]);
        lastSelectedFilePath = selectedPathForContextMenu;
        updateTreeSelectionClasses();
      }
    } else {
      if (currentSidebarDir) {
        selectedPathForContextMenu = currentSidebarDir;
        selectedIsDir = true;
      } else {
        contextMenu.style.display = 'none';
        return;
      }
    }

    updateFileContextMenuState(Boolean(node));
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    lucide.createIcons();
  });

  // Hide context menu when clicking elsewhere (using capturing phase to bypass child stopPropagation)
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.style.display = 'none';
    }
  }, true);

  // Refresh sidebar from context menu
  ctxRefreshSidebar.addEventListener('click', async () => {
    contextMenu.style.display = 'none';
    await refreshSidebarDirectory();
  });

  // Open item from context menu
  ctxOpenItem.addEventListener('click', async () => {
    contextMenu.style.display = 'none';
    await openContextMenuItem();
  });

  // Reveal item in OS file manager
  ctxShowInFolder.addEventListener('click', async () => {
    contextMenu.style.display = 'none';
    const targetPath = selectedPathForContextMenu;
    if (!targetPath) return;
    const result = await window.electronAPI.showItemInFolder(targetPath);
    if (!result.success) {
      alert(`Error showing item: ${result.error}`);
    }
  });

  // Copy one or more paths to the clipboard
  ctxCopyPath.addEventListener('click', async () => {
    contextMenu.style.display = 'none';
    const paths = getContextTargetPaths();
    if (paths.length === 0) return;
    try {
      const text = paths.join('\n');
      if (window.electronAPI.copyText) {
        window.electronAPI.copyText(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      alert(`Error copying path: ${error.message}`);
    }
  });

  // Create file from context menu
  ctxCreateFile.addEventListener('click', () => {
    contextMenu.style.display = 'none';
    const parentDir = getContextCreationDirectory();
    if (!parentDir) {
      alert('Please select a folder before creating a file.');
      return;
    }
    showInputDialog('Create New File', 'Untitled', 'Enter filename', async (val) => {
      if (!val) return false;
      let formattedName = val;
      if (!formattedName.endsWith('.md') && !formattedName.endsWith('.markdown') && !formattedName.endsWith('.txt')) {
        formattedName += '.md';
      }
      const result = await window.electronAPI.createInDir(parentDir, formattedName);
      if (result.success) {
        if (currentSidebarDir) await loadSidebarDirectory(currentSidebarDir);
        loadFile(result.filePath, '', result.fileName);
        return true;
      } else {
        alert(`Error creating file: ${result.error}`);
        return false;
      }
    });
  });

  // Create folder from context menu
  ctxCreateFolder.addEventListener('click', () => {
    contextMenu.style.display = 'none';
    const parentDir = getContextCreationDirectory();
    if (!parentDir) {
      alert('Please select a folder before creating a folder.');
      return;
    }
    showInputDialog('Create New Folder', 'New Folder', 'Enter folder name', async (val) => {
      if (!val) return false;
      const result = await window.electronAPI.createDir(parentDir, val);
      if (result.success) {
        if (currentSidebarDir) await loadSidebarDirectory(currentSidebarDir);
        return true;
      } else {
        alert(`Error creating folder: ${result.error}`);
        return false;
      }
    });
  });

  // Rename item from context menu
  ctxRenameItem.addEventListener('click', () => {
    contextMenu.style.display = 'none';
    const targetPath = selectedPathForContextMenu;
    if (!targetPath) return;
    const basename = targetPath.split(/[/\\]/).pop();
    showInputDialog('Rename Item', basename, 'Enter new name', async (val) => {
      if (!val) return false;
      if (val === basename) return true;
      const result = await window.electronAPI.renameItem(targetPath, val);
      if (result.success) {
        if (targetPath === currentFilePath) {
          currentFilePath = result.newPath;
          currentFilename.innerText = val;
          currentFilepathStatus.innerText = result.newPath;
        }
        if (currentSidebarDir) await loadSidebarDirectory(currentSidebarDir);
        return true;
      } else {
        alert(`Error renaming: ${result.error}`);
        return false;
      }
    });
  });

  // Delete item from context menu
  ctxDeleteItem.addEventListener('click', async () => {
    contextMenu.style.display = 'none';
    const targetPaths = getContextTargetPaths();
    if (targetPaths.length === 0) return;
    const label = targetPaths.length === 1
      ? `"${targetPaths[0].split(/[/\\]/).pop()}"`
      : `${targetPaths.length} selected items`;
    const confirmDelete = confirm(`Are you sure you want to delete ${label}?`);
    if (confirmDelete) {
      const errors = [];
      for (const targetPath of targetPaths) {
        const result = await window.electronAPI.deleteItem(targetPath);
        if (result.success) {
          if (targetPath === currentFilePath) {
            currentFilePath = null;
          }
        } else {
          errors.push(`${targetPath}: ${result.error}`);
        }
      }
      if (errors.length === 0) {
        if (!currentFilePath && targetPaths.length > 0) {
          newFile();
        }
      } else {
        alert(`Some items could not be deleted:\n${errors.join('\n')}`);
      }
      selectedFileTreePaths.clear();
      selectedPathForContextMenu = null;
      selectedIsDir = false;
      if (currentSidebarDir) {
        await loadSidebarDirectory(currentSidebarDir);
      }
    }
  });

  // Modal Cancel
  btnModalCancel.addEventListener('click', () => {
    closeInputDialog();
  });

  // Modal Confirm
  btnModalConfirm.addEventListener('click', submitInputDialog);

  // Modal Input enter/escape keys
  modalInputFilename.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitInputDialog();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeInputDialog();
    }
  });

  // Unsaved changes modal actions
  unsavedModal.addEventListener('click', (e) => {
    const actionButton = e.target.closest('[data-unsaved-action]');
    if (!actionButton) return;
    e.preventDefault();
    e.stopPropagation();
    resolveUnsavedPrompt(actionButton.dataset.unsavedAction);
  });
  unsavedModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      resolveUnsavedPrompt('cancel');
    }
  });

  // Export File Options
  btnExportPdf.addEventListener('click', exportPdf);
  btnExportHtml.addEventListener('click', exportHtml);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', handleGlobalShortcuts);

  // ---------- Find / Replace Bar ----------
  findCloseBtn.addEventListener('click', hideFindBar);

  // Options change re-runs search if already active
  findCaseSensitive.addEventListener('change', () => { if (findMatches.length > 0 || findInput.value) performFind(); });
  findUseRegex.addEventListener('change',        () => { if (findMatches.length > 0 || findInput.value) performFind(); });
  findInput.addEventListener('input', performFind);

  // Navigation buttons
  findNextBtn.addEventListener('click', findNext);
  findPrevBtn.addEventListener('click', findPrev);

  // Replace buttons
  findReplaceOneBtn.addEventListener('click', replaceOne);
  findReplaceAllBtn.addEventListener('click', replaceAll);

  // Keyboard inside find input: Enter = search/navigate, Esc = close
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If matches already exist navigate; otherwise run first search
      if (findMatches.length > 0) {
        if (e.shiftKey) findPrev(); else findNext();
      } else {
        performFind();
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); hideFindBar(); }
  });
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) replaceAll(); else replaceOne();
    }
    if (e.key === 'Escape') { e.preventDefault(); hideFindBar(); }
  });

  // ---------- Editor Right-Click Context Menu ----------
  // Shared handler for both textarea and live-edit previewContent
  function showEditorContextMenu(e) {
    e.preventDefault();
    let currentHeadingLevel = 0;
    let currentTableCell = null;
    if (e.currentTarget === markdownTextarea) {
      savedTextareaSelection = {
        start: markdownTextarea.selectionStart,
        end: markdownTextarea.selectionEnd
      };
      currentHeadingLevel = getTextareaHeadingLevel(savedTextareaSelection.start);
      savedLiveSelection = null;
    } else {
      currentTableCell = currentViewMode === 'live'
        ? e.target.closest('td, th')
        : null;
      if (currentTableCell && !previewContent.contains(currentTableCell)) {
        currentTableCell = null;
      }
      const selection = window.getSelection();
      savedLiveSelection = selection.rangeCount && previewContent.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null;
      currentHeadingLevel = getRenderedHeadingLevel(savedLiveSelection);
      savedTextareaSelection = null;
    }
    updateContextHeadingState(currentHeadingLevel);
    updateTableContextMenuState(currentTableCell);
    contextMenu.style.display = 'none';
    editorContextMenu.style.display = 'block';
    const menuW = 220, menuH = Math.min(editorContextMenu.scrollHeight, window.innerHeight * 0.8);
    let x = e.clientX, y = e.clientY;
    if (x + menuW > window.innerWidth)  x = window.innerWidth - menuW - 8;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
    editorContextMenu.style.left = `${x}px`;
    editorContextMenu.style.top  = `${y}px`;
    lucide.createIcons();
  }
  markdownTextarea.addEventListener('contextmenu', showEditorContextMenu);
  previewContent.addEventListener('contextmenu', showEditorContextMenu);

  // Hide editor context menu on any click outside
  document.addEventListener('click', (e) => {
    if (!editorContextMenu.contains(e.target)) {
      editorContextMenu.style.display = 'none';
      tableContextCell = null;
    }
  }, true);

  // Editor context menu actions
  const ecmActions = [
    ['ectx-bold',          () => insertFormattingUniversal('**', '**')],
    ['ectx-italic',        () => insertFormattingUniversal('*', '*')],
    ['ectx-strikethrough', () => insertFormattingUniversal('~~', '~~')],
    ['ectx-inline-code',   () => insertFormattingUniversal('`', '`')],
    ['ectx-highlight',     () => insertFormattingUniversal('==', '==')],
    ['ectx-h1',            () => insertLinePrefixUniversal('# ')],
    ['ectx-h2',            () => insertLinePrefixUniversal('## ')],
    ['ectx-h3',            () => insertLinePrefixUniversal('### ')],
    ['ectx-h4',            () => insertLinePrefixUniversal('#### ')],
    ['ectx-h5',            () => insertLinePrefixUniversal('##### ')],
    ['ectx-h6',            () => insertLinePrefixUniversal('###### ')],
    ['ectx-clear-format',  clearFormattingUniversal],
    ['ectx-link',          () => insertFormattingUniversal('[', '](url)')],
    ['ectx-image',         () => insertFormattingUniversal('![', '](image-url)')],
    ['ectx-codeblock',     () => insertFormattingUniversal('\n```\n', '\n```\n')],
    ['ectx-blockquote',    () => insertLinePrefixUniversal('> ')],
    ['ectx-table',         () => insertFormattingUniversal('\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n', '')],
    ['ectx-ul',            () => insertLinePrefixUniversal('- ')],
    ['ectx-ol',            () => insertLinePrefixUniversal('1. ')],
    ['ectx-hr',            () => insertFormattingUniversal('\n\n---\n\n', '')],
    ['ectx-table-row-above', () => editTableAtContext('insert-row-above')],
    ['ectx-table-row-below', () => editTableAtContext('insert-row-below')],
    ['ectx-table-col-left',  () => editTableAtContext('insert-col-left')],
    ['ectx-table-col-right', () => editTableAtContext('insert-col-right')],
    ['ectx-table-delete-row', () => editTableAtContext('delete-row')],
    ['ectx-table-delete-col', () => editTableAtContext('delete-col')],
    ['ectx-find',          () => showFindBar()],
  ];
  ecmActions.forEach(([id, fn]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => { editorContextMenu.style.display = 'none'; fn(); });
  });

  // Sync scroll in split mode
  markdownTextarea.addEventListener(
    'scroll',
    () => scheduleSplitScrollSync(markdownTextarea, previewContainer),
    { passive: true }
  );

  previewContainer.addEventListener(
    'scroll',
    () => scheduleSplitScrollSync(previewContainer, markdownTextarea),
    { passive: true }
  );

  // Sort Dropdown
  if (sortDropdown) {
    sortDropdown.addEventListener('change', (e) => {
      const chosenSort = e.target.value;
      localStorage.setItem('sidebar-sort-by', chosenSort);
      if (sidebarFilesData && sidebarFilesData.length > 0) {
        const sortedTree = sortFiles(sidebarFilesData, chosenSort);
        visibleFilePaths = collectVisibleFilePaths(sortedTree);
        pruneSelectedFileTreePaths();
        renderDirectoryTree(sortedTree, dirTree);
      }
    });
  }
}

function setupExternalFileOpenListener() {
  if (!window.electronAPI || typeof window.electronAPI.onOpenFile !== 'function') return;

  window.electronAPI.onOpenFile(async (fileData) => {
    if (!fileData || !fileData.filePath || typeof fileData.content !== 'string') return;

    const previousOffset = getActiveEditorOffset();
    if (!await confirmFileTransition(previousOffset)) return;

    loadFile(fileData.filePath, fileData.content, fileData.fileName || fileData.filePath.split(/[/\\]/).pop());
    addRecentItem('file', fileData.filePath);
  });
}

let splitScrollSyncFrame = null;
let ignoredProgrammaticScrollElement = null;

function clearSplitScrollSync() {
  if (splitScrollSyncFrame !== null) {
    cancelAnimationFrame(splitScrollSyncFrame);
    splitScrollSyncFrame = null;
  }
  ignoredProgrammaticScrollElement = null;
}

function scheduleSplitScrollSync(sourceElement, targetElement) {
  if (currentViewMode !== 'split') {
    clearSplitScrollSync();
    return;
  }

  if (ignoredProgrammaticScrollElement === sourceElement) {
    ignoredProgrammaticScrollElement = null;
    return;
  }

  if (splitScrollSyncFrame !== null) {
    cancelAnimationFrame(splitScrollSyncFrame);
  }

  splitScrollSyncFrame = requestAnimationFrame(() => {
    splitScrollSyncFrame = null;
    if (currentViewMode !== 'split') return;

    const sourceScrollableHeight = sourceElement.scrollHeight - sourceElement.clientHeight;
    if (sourceScrollableHeight <= 0) return;

    const targetScrollableHeight = Math.max(0, targetElement.scrollHeight - targetElement.clientHeight);
    const scrollPercent = sourceElement.scrollTop / sourceScrollableHeight;
    const nextScrollTop = scrollPercent * targetScrollableHeight;

    if (Math.abs(targetElement.scrollTop - nextScrollTop) < 1) return;

    ignoredProgrammaticScrollElement = targetElement;
    targetElement.scrollTop = nextScrollTop;

    requestAnimationFrame(() => {
      if (ignoredProgrammaticScrollElement === targetElement) {
        ignoredProgrammaticScrollElement = null;
      }
    });
  });
}

// --- Keyboard Shortcuts ---
function handleGlobalShortcuts(e) {
  const key = e.key.toLowerCase();
  const isEditorTarget = e.target === markdownTextarea || previewContent.contains(e.target);

  if (e.ctrlKey || e.metaKey) {
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      e.preventDefault();
      changeAppZoom(APP_ZOOM_STEP);
      return;
    }
    if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      changeAppZoom(-APP_ZOOM_STEP);
      return;
    }
    if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault();
      setAppZoom(100);
      return;
    }
  }

  if ((e.ctrlKey || e.metaKey) && isEditorTarget && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redoEditorChange(); else undoEditorChange();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && isEditorTarget && key === 'y') {
    e.preventDefault();
    redoEditorChange();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    newFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    openFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '1') {
    e.preventDefault();
    setViewMode('edit');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '2') {
    e.preventDefault();
    setViewMode('split');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '3') {
    e.preventDefault();
    setViewMode('preview');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '4') {
    e.preventDefault();
    setViewMode('live');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    insertFormatting('**', '**');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    insertFormatting('*', '*');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    insertFormatting('[', '](url)');
  }
  // Ctrl+F — open find bar (all modes that have an editor)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    showFindBar();
  }
  // Ctrl+H — heading shortcut already handled in toolbar; also open find bar
  if (e.key === 'Escape') {
    if (findBar && findBar.style.display !== 'none') {
      e.preventDefault();
      hideFindBar();
    }
  }
}

// ============================================================
// Find / Replace Bar Logic
// ============================================================

function showFindBar() {
  if (!findBar) return;
  if (findBar.style.display !== 'none') {
    findInput.focus({ preventScroll: true });
    findInput.select();
    return;
  }

  if (currentViewMode === 'live' || currentViewMode === 'preview') {
    findStartOffset = Math.max(0, getCaretCharOffset(previewContent));
  } else {
    findStartOffset = markdownTextarea.selectionStart;
  }

  findBar.style.display = 'block';
  lucide.createIcons();
  // Pre-fill with selected text
  const selection = window.getSelection();
  const liveSelection = (currentViewMode === 'live' || currentViewMode === 'preview') &&
    selection.rangeCount && previewContent.contains(selection.anchorNode)
    ? selection.toString()
    : '';
  const sel = liveSelection || markdownTextarea.value.substring(
    markdownTextarea.selectionStart,
    markdownTextarea.selectionEnd
  );
  if (sel && sel.length < 200) {
    findInput.value = sel;
  }
  findInput.focus();
  findInput.select();
  performFind();
}

function hideFindBar() {
  if (!findBar) return;
  findBar.style.display = 'none';
  findMatches = [];
  findCurrentIndex = -1;
  findCountSpan.textContent = '';
  findCountSpan.className = 'find-count';
  clearFindHighlight();
  if (currentViewMode === 'live') {
    previewContent.focus();
  } else if (currentViewMode !== 'preview') {
    markdownTextarea.focus();
  }
}

// ============================================================
// Editor focus and cross-mode undo/redo
// ============================================================
function getNodePath(root, node) {
  if (!root || !node || !root.contains(node)) return null;

  const path = [];
  let current = node;
  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  return path;
}

function getNodeFromPath(root, path) {
  if (!root || !Array.isArray(path)) return null;

  let current = root;
  for (const index of path) {
    if (!current || !current.childNodes || index < 0 || index >= current.childNodes.length) {
      return null;
    }
    current = current.childNodes[index];
  }
  return current;
}

function clampNodeOffset(node, offset) {
  if (!node) return 0;
  const maxOffset = node.nodeType === Node.TEXT_NODE
    ? node.textContent.length
    : node.childNodes.length;
  return Math.max(0, Math.min(offset, maxOffset));
}

function captureLiveSelectionState() {
  const selection = window.getSelection();
  if (!selection.rangeCount || !previewContent.contains(selection.anchorNode)) return null;

  return {
    anchorPath: getNodePath(previewContent, selection.anchorNode),
    anchorOffset: selection.anchorOffset,
    focusPath: getNodePath(previewContent, selection.focusNode),
    focusOffset: selection.focusOffset
  };
}

function restoreLiveSelectionState(selectionState) {
  if (!selectionState) return false;

  const anchorNode = getNodeFromPath(previewContent, selectionState.anchorPath);
  const focusNode = getNodeFromPath(previewContent, selectionState.focusPath);
  if (!anchorNode || !focusNode) return false;

  const range = document.createRange();
  try {
    range.setStart(anchorNode, clampNodeOffset(anchorNode, selectionState.anchorOffset));
    range.setEnd(focusNode, clampNodeOffset(focusNode, selectionState.focusOffset));
  } catch {
    return false;
  }

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function getSelectionRangeRect() {
  const selection = window.getSelection();
  if (!selection.rangeCount || !previewContent.contains(selection.anchorNode)) return null;

  const range = selection.getRangeAt(0).cloneRange();
  let rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) return rect;

  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  range.insertNode(marker);
  rect = marker.getBoundingClientRect();
  marker.remove();
  return rect;
}

function scrollLiveEditorToCaret() {
  const rect = getSelectionRangeRect();
  if (!rect) return;

  const containerRect = previewContainer.getBoundingClientRect();
  const topPadding = Math.max(24, previewContainer.clientHeight * 0.18);
  const bottomPadding = Math.max(24, previewContainer.clientHeight * 0.18);

  if (rect.top < containerRect.top + topPadding) {
    previewContainer.scrollTop -= (containerRect.top + topPadding) - rect.top;
  } else if (rect.bottom > containerRect.bottom - bottomPadding) {
    previewContainer.scrollTop += rect.bottom - (containerRect.bottom - bottomPadding);
  }

  updateActiveLiveHeading();
}

function scrollTextareaToCaret(offset) {
  if (offset === null || offset === undefined) return;

  const textBeforeCaret = markdownTextarea.value.substring(0, offset);
  const lineIndex = textBeforeCaret.split('\n').length - 1;
  const computedStyle = window.getComputedStyle(markdownTextarea);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 25.5;
  const targetTop = Math.max(0, (lineIndex * lineHeight) - (markdownTextarea.clientHeight * 0.35));
  markdownTextarea.scrollTop = targetTop;
}

function scrollActiveEditorToCaret(offset = null) {
  if (currentViewMode === 'live') {
    scrollLiveEditorToCaret();
  } else if (currentViewMode !== 'preview') {
    scrollTextareaToCaret(offset);
  }
}

function restoreEditorScrollTop(scrollTop) {
  if (!Number.isFinite(scrollTop)) return false;

  if (currentViewMode === 'live') {
    previewContainer.scrollTop = Math.max(0, scrollTop);
    updateLiveHeadingNavPosition();
    updateActiveLiveHeading();
    updateLiveScrollControls();
    return true;
  }

  if (currentViewMode !== 'preview') {
    markdownTextarea.scrollTop = Math.max(0, scrollTop);
    return true;
  }

  return false;
}

function focusActiveEditor(offset = null, liveSelection = null, options = {}) {
  const { scrollToCaret = false, scrollTop = null } = options;
  const restoreFocus = () => {
    if (currentViewMode === 'live') {
      previewContent.focus({ preventScroll: true });
      const restoredSelection = restoreLiveSelectionState(liveSelection);
      if (!restoredSelection) {
        const currentOffset = getCaretCharOffset(previewContent);
        setCaretCharOffset(previewContent, offset ?? (currentOffset >= 0 ? currentOffset : 0));
      }
    } else if (currentViewMode !== 'preview') {
      markdownTextarea.focus({ preventScroll: true });
      if (offset !== null) {
        const safeOffset = Math.max(0, Math.min(offset, markdownTextarea.value.length));
        markdownTextarea.setSelectionRange(safeOffset, safeOffset);
      }
    }
    const restoredScrollTop = restoreEditorScrollTop(scrollTop);
    if (scrollToCaret && !restoredScrollTop) {
      scrollActiveEditorToCaret(offset);
    }
  };

  // Native confirm/file dialogs can return focus a little later than the next
  // animation frame in Electron. Retry briefly so the sidebar button or window
  // chrome cannot retain focus and leave the editor without a caret.
  requestAnimationFrame(() => requestAnimationFrame(restoreFocus));
  setTimeout(restoreFocus, 50);
  setTimeout(restoreFocus, 150);
}

function getActiveEditorOffset() {
  if (currentViewMode === 'live') {
    const offset = getCaretCharOffset(previewContent);
    return offset >= 0 ? offset : 0;
  }
  return markdownTextarea.selectionStart;
}

function captureEditorState() {
  const liveOffset = currentViewMode === 'live' ? getCaretCharOffset(previewContent) : -1;
  return {
    content: markdownTextarea.value,
    selectionStart: liveOffset >= 0 ? liveOffset : markdownTextarea.selectionStart,
    selectionEnd: liveOffset >= 0 ? liveOffset : markdownTextarea.selectionEnd,
    liveSelection: currentViewMode === 'live' ? captureLiveSelectionState() : null,
    liveScrollTop: previewContainer ? previewContainer.scrollTop : 0,
    textareaScrollTop: markdownTextarea ? markdownTextarea.scrollTop : 0
  };
}

function recordEditorState() {
  if (isRestoringHistory) return;
  const state = captureEditorState();
  const previous = undoStack[undoStack.length - 1];
  if (previous && previous.content === state.content &&
      previous.selectionStart === state.selectionStart &&
      previous.selectionEnd === state.selectionEnd) {
    return;
  }
  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY_ENTRIES) undoStack.shift();
  redoStack.length = 0;
}

function resetEditorHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
}

function restoreEditorState(state) {
  if (!state) return;
  isRestoringHistory = true;
  markdownTextarea.value = state.content;
  isModified = state.content !== originalContent;
  unsavedIndicator.style.display = isModified ? 'inline-block' : 'none';
  updateStats();
  generateOutline();

  if (currentViewMode === 'live') {
    renderLiveEditMode();
  } else {
    renderMarkdown();
  }

  const offset = Math.max(0, Math.min(state.selectionStart, state.content.length));
  const scrollTop = currentViewMode === 'live' ? state.liveScrollTop : state.textareaScrollTop;
  focusActiveEditor(offset, state.liveSelection, { scrollToCaret: true, scrollTop });
  isRestoringHistory = false;
}

function undoEditorChange() {
  if (undoStack.length === 0) return;
  redoStack.push(captureEditorState());
  restoreEditorState(undoStack.pop());
}

function redoEditorChange() {
  if (redoStack.length === 0) return;
  undoStack.push(captureEditorState());
  restoreEditorState(redoStack.pop());
}

function getTextareaHeadingLevel(position) {
  const text = markdownTextarea.value;
  const lineStart = text.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const lineEndIndex = text.indexOf('\n', position);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const match = text.substring(lineStart, lineEnd).match(/^(#{1,6})\s+/);
  return match ? match[1].length : 0;
}

function getRenderedHeadingLevel(range) {
  if (!range) return 0;
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const heading = node?.closest?.('h1, h2, h3, h4, h5, h6');
  return heading && previewContent.contains(heading)
    ? Number(heading.tagName.substring(1))
    : 0;
}

function updateContextHeadingState(level) {
  for (let headingLevel = 1; headingLevel <= 6; headingLevel++) {
    const button = document.getElementById(`ectx-h${headingLevel}`);
    if (!button) continue;
    const isCurrent = headingLevel === level;
    button.classList.toggle('current-heading', isCurrent);
    if (isCurrent) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function getTableRows(table) {
  return Array.from(table.querySelectorAll('tr'));
}

function getTableCells(row) {
  return Array.from(row?.children || []).filter((cell) => cell.matches('th, td'));
}

function getTableColumnCount(table) {
  return Math.max(0, ...getTableRows(table).map((row) => getTableCells(row).length));
}

function getTableCellColumnIndex(cell) {
  return getTableCells(cell?.closest('tr')).indexOf(cell);
}

function updateTableContextMenuState(cell) {
  tableContextCell = cell || null;
  const hasTableContext = Boolean(tableContextCell);
  editorContextMenu.classList.toggle('has-table-context', hasTableContext);

  const deleteRowButton = document.getElementById('ectx-table-delete-row');
  const deleteColButton = document.getElementById('ectx-table-delete-col');
  if (!deleteRowButton || !deleteColButton) return;

  const table = tableContextCell?.closest('table');
  deleteRowButton.disabled = !table || getTableRows(table).length <= 1;
  deleteColButton.disabled = !table || getTableColumnCount(table) <= 1;
}

function createEmptyTableCell(referenceCell) {
  const cell = document.createElement(referenceCell?.tagName === 'TH' ? 'th' : 'td');
  cell.appendChild(document.createElement('br'));
  return cell;
}

function placeCaretInTableCell(cell) {
  if (!cell || !previewContent.contains(cell)) return;
  previewContent.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function commitTableContextEdit(focusCell) {
  initTurndown();
  syncLiveContentToTextarea();
  isModified = true;
  unsavedIndicator.style.display = 'inline-block';
  updateStats();
  generateOutline();
  tableContextCell = focusCell || null;
  requestAnimationFrame(updateLiveScrollControls);
  requestAnimationFrame(() => placeCaretInTableCell(focusCell));
}

function insertTableRowAtContext(position) {
  const currentCell = tableContextCell;
  const currentRow = currentCell?.closest('tr');
  if (!currentCell || !currentRow) return;

  recordEditorState();
  const newRow = document.createElement('tr');
  getTableCells(currentRow).forEach((cell) => {
    newRow.appendChild(createEmptyTableCell(cell));
  });

  if (position === 'above') {
    currentRow.parentNode.insertBefore(newRow, currentRow);
  } else {
    currentRow.parentNode.insertBefore(newRow, currentRow.nextSibling);
  }

  const columnIndex = Math.max(0, getTableCellColumnIndex(currentCell));
  commitTableContextEdit(getTableCells(newRow)[columnIndex] || newRow.firstElementChild);
}

function insertTableColumnAtContext(position) {
  const currentCell = tableContextCell;
  const table = currentCell?.closest('table');
  const currentColumnIndex = getTableCellColumnIndex(currentCell);
  if (!currentCell || !table || currentColumnIndex < 0) return;

  recordEditorState();
  let focusCell = null;
  getTableRows(table).forEach((row) => {
    const cells = getTableCells(row);
    const referenceIndex = Math.min(currentColumnIndex, Math.max(0, cells.length - 1));
    const referenceCell = cells[referenceIndex] || currentCell;
    const newCell = createEmptyTableCell(referenceCell);
    const insertBeforeIndex = position === 'left' ? currentColumnIndex : currentColumnIndex + 1;
    row.insertBefore(newCell, cells[insertBeforeIndex] || null);
    if (row === currentCell.closest('tr')) {
      focusCell = newCell;
    }
  });

  commitTableContextEdit(focusCell);
}

function deleteTableRowAtContext() {
  const currentCell = tableContextCell;
  const currentRow = currentCell?.closest('tr');
  const table = currentCell?.closest('table');
  if (!currentCell || !currentRow || !table || getTableRows(table).length <= 1) return;

  recordEditorState();
  const rows = getTableRows(table);
  const rowIndex = rows.indexOf(currentRow);
  const columnIndex = Math.max(0, getTableCellColumnIndex(currentCell));
  const nextFocusRow = rows[rowIndex + 1] || rows[rowIndex - 1] || null;
  currentRow.remove();
  const focusCell = nextFocusRow
    ? getTableCells(nextFocusRow)[Math.min(columnIndex, getTableCells(nextFocusRow).length - 1)]
    : null;
  commitTableContextEdit(focusCell);
}

function deleteTableColumnAtContext() {
  const currentCell = tableContextCell;
  const table = currentCell?.closest('table');
  const columnIndex = getTableCellColumnIndex(currentCell);
  if (!currentCell || !table || columnIndex < 0 || getTableColumnCount(table) <= 1) return;

  recordEditorState();
  let focusCell = null;
  const currentRow = currentCell.closest('tr');
  getTableRows(table).forEach((row) => {
    const cells = getTableCells(row);
    const cellToRemove = cells[columnIndex];
    if (!cellToRemove) return;
    const fallbackCell = cells[columnIndex + 1] || cells[columnIndex - 1] || null;
    if (row === currentRow) {
      focusCell = fallbackCell;
    }
    cellToRemove.remove();
  });

  commitTableContextEdit(focusCell);
}

function editTableAtContext(action) {
  if (currentViewMode !== 'live' || !tableContextCell || !previewContent.contains(tableContextCell)) return;

  if (action === 'insert-row-above') insertTableRowAtContext('above');
  else if (action === 'insert-row-below') insertTableRowAtContext('below');
  else if (action === 'insert-col-left') insertTableColumnAtContext('left');
  else if (action === 'insert-col-right') insertTableColumnAtContext('right');
  else if (action === 'delete-row') deleteTableRowAtContext();
  else if (action === 'delete-col') deleteTableColumnAtContext();
}

/**
 * Core search: builds findMatches array from current textarea content.
 * Uses native string or regex matching depending on options.
 */
function performFind() {
  const term = findInput.value;
  findSearchTerm = term;
  findMatches = [];
  findLiveRanges = [];
  findCurrentIndex = -1;
  clearFindHighlight();

  if (!term) {
    findCountSpan.textContent = '';
    findCountSpan.className = 'find-count';
    return;
  }

  const isRenderedMode = currentViewMode === 'live' || currentViewMode === 'preview';
  const renderedTextData = isRenderedMode ? collectRenderedText(previewContent) : null;
  const text = isRenderedMode ? renderedTextData.text : markdownTextarea.value;
  const caseSensitive = findCaseSensitive.checked;
  const useRegex = findUseRegex.checked;

  try {
    let pattern;
    if (useRegex) {
      pattern = new RegExp(term, caseSensitive ? 'g' : 'gi');
    } else {
      // Escape special regex chars for literal search
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const foundMatch = { start: match.index, end: match.index + match[0].length };
      findMatches.push(foundMatch);
      if (isRenderedMode) {
        findLiveRanges.push(createRangeFromTextOffsets(renderedTextData.nodes, foundMatch.start, foundMatch.end));
      }
      // Safety: avoid infinite loop on zero-length match
      if (match[0].length === 0) pattern.lastIndex++;
    }
  } catch (err) {
    // Invalid regex — show error state
    findCountSpan.textContent = '无效的正则表达式';
    findCountSpan.className = 'find-count no-match';
    return;
  }

  if (findMatches.length === 0) {
    findCountSpan.textContent = term ? '无匹配' : '';
    findCountSpan.className = 'find-count no-match';
    return;
  }

  // Jump to first match closest to cursor
  const cursorPos = findStartOffset;
  findCurrentIndex = findMatches.findIndex(m => m.start >= cursorPos);
  if (findCurrentIndex === -1) findCurrentIndex = 0;

  updateFindCount();
  scrollToMatch(findCurrentIndex);
}

function updateFindCount() {
  if (findMatches.length === 0) return;
  findCountSpan.textContent = `${findCurrentIndex + 1} / ${findMatches.length}`;
  findCountSpan.className = 'find-count';
}

/**
 * Scroll the textarea to the match at the given index and select it.
 */
function scrollToMatch(index) {
  if (index < 0 || index >= findMatches.length) return;
  const m = findMatches[index];

  if (currentViewMode === 'live' || currentViewMode === 'preview') {
    const range = findLiveRanges[index];
    if (range) {
      highlightRenderedRange(range);
      const target = range.startContainer.parentElement || previewContent;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    focusFindInput();
    return;
  }

  // Scroll to the matching line without moving focus/caret away from search.
  const textBefore = markdownTextarea.value.substring(0, m.start);
  const linesBeforeMatch = textBefore.split('\n').length;
  const lineHeight = 25.5; // 15px * 1.7
  const viewableLines = markdownTextarea.clientHeight / lineHeight;
  markdownTextarea.scrollTop = Math.max(0, (linesBeforeMatch - Math.floor(viewableLines / 2)) * lineHeight);
  focusFindInput();
}

function findNext() {
  if (findMatches.length === 0) { performFind(); return; }
  findCurrentIndex = (findCurrentIndex + 1) % findMatches.length;
  updateFindCount();
  scrollToMatch(findCurrentIndex);
}

function findPrev() {
  if (findMatches.length === 0) { performFind(); return; }
  findCurrentIndex = (findCurrentIndex - 1 + findMatches.length) % findMatches.length;
  updateFindCount();
  scrollToMatch(findCurrentIndex);
}

function focusFindInput() {
  if (findBar && findBar.style.display !== 'none') {
    findInput.focus({ preventScroll: true });
  }
}

function clearFindHighlight() {
  if (window.CSS && CSS.highlights) {
    CSS.highlights.delete('markdown-find-current');
  }
  previewContent?.querySelectorAll('.find-scroll-target').forEach(el => el.classList.remove('find-scroll-target'));
}

function collectRenderedText(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodes = [];
  let text = '';
  let node;
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: text.length, end: text.length + node.nodeValue.length });
    text += node.nodeValue;
  }
  return { text, nodes };
}

function createRangeFromTextOffsets(nodes, start, end) {
  const startEntry = nodes.find(entry => start >= entry.start && start <= entry.end);
  const endEntry = nodes.find(entry => end >= entry.start && end <= entry.end);
  if (!startEntry || !endEntry) return null;
  const range = document.createRange();
  range.setStart(startEntry.node, Math.min(start - startEntry.start, startEntry.node.nodeValue.length));
  range.setEnd(endEntry.node, Math.min(end - endEntry.start, endEntry.node.nodeValue.length));
  return range;
}

function highlightRenderedRange(range) {
  clearFindHighlight();
  if (window.CSS && CSS.highlights && typeof Highlight !== 'undefined') {
    CSS.highlights.set('markdown-find-current', new Highlight(range));
  } else {
    const target = range.startContainer.parentElement;
    if (target) target.classList.add('find-scroll-target');
  }
}

function replaceOne() {
  if (findMatches.length === 0 || findCurrentIndex === -1) return;
  recordEditorState();

  if (currentViewMode === 'live' || currentViewMode === 'preview') {
    const range = findLiveRanges[findCurrentIndex];
    if (!range) return;
    range.deleteContents();
    range.insertNode(document.createTextNode(replaceInput.value));
    initTurndown();
    syncLiveContentToTextarea();
    if (currentViewMode === 'preview') renderMarkdown();
    performFind();
    focusFindInput();
    return;
  }

  const m = findMatches[findCurrentIndex];
  const replaceWith = replaceInput.value;
  const text = markdownTextarea.value;

  markdownTextarea.value = text.substring(0, m.start) + replaceWith + text.substring(m.end);

  // Trigger standard update
  isModified = true;
  unsavedIndicator.style.display = 'inline-block';
  updateStats();
  clearTimeout(window._renderTimer);
  window._renderTimer = setTimeout(() => { renderMarkdown(); generateOutline(); }, 80);

  // Re-search from same position
  const nextStart = m.start + replaceWith.length;
  performFind();
  // Advance to the match at or after the replaced position
  const nextIdx = findMatches.findIndex(mm => mm.start >= nextStart);
  findCurrentIndex = nextIdx !== -1 ? nextIdx : 0;
  if (findMatches.length > 0) {
    updateFindCount();
    scrollToMatch(findCurrentIndex);
  }
}

function replaceAll() {
  if (findMatches.length === 0) return;
  const replaceWith = replaceInput.value;
  const term = findInput.value;
  if (!term) return;
  recordEditorState();

  if (currentViewMode === 'live' || currentViewMode === 'preview') {
    [...findLiveRanges].reverse().forEach(range => {
      if (!range) return;
      range.deleteContents();
      range.insertNode(document.createTextNode(replaceWith));
    });
    const count = findMatches.length;
    initTurndown();
    syncLiveContentToTextarea();
    if (currentViewMode === 'preview') renderMarkdown();
    findMatches = [];
    findLiveRanges = [];
    findCurrentIndex = -1;
    clearFindHighlight();
    findCountSpan.textContent = `已替换 ${count} 处`;
    findCountSpan.className = 'find-count';
    focusFindInput();
    return;
  }

  const caseSensitive = findCaseSensitive.checked;
  const useRegex = findUseRegex.checked;

  let pattern;
  try {
    if (useRegex) {
      pattern = new RegExp(term, caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }
  } catch (err) { return; }

  const count = findMatches.length;
  markdownTextarea.value = markdownTextarea.value.replace(pattern, replaceWith);

  isModified = true;
  unsavedIndicator.style.display = 'inline-block';
  updateStats();
  clearTimeout(window._renderTimer);
  window._renderTimer = setTimeout(() => { renderMarkdown(); generateOutline(); }, 80);

  findMatches = [];
  findCurrentIndex = -1;
  findCountSpan.textContent = `已替换 ${count} 处`;
  findCountSpan.className = 'find-count';
}

// ============================================================
// Formatting shared by the plain-text and live editors.
// ============================================================
function restoreSavedTextareaSelection() {
  if (!savedTextareaSelection) return;
  markdownTextarea.selectionStart = savedTextareaSelection.start;
  markdownTextarea.selectionEnd = savedTextareaSelection.end;
}

function restoreSavedLiveSelection() {
  if (!savedLiveSelection) return null;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedLiveSelection.cloneRange());
  return selection.getRangeAt(0);
}

function commitLiveFormatting() {
  const caretOffset = getCaretCharOffset(previewContent);
  initTurndown();
  syncLiveContentToTextarea();
  isModified = true;
  unsavedIndicator.style.display = 'inline-block';
  updateStats();
  generateOutline();
  if (currentViewMode !== 'live') renderMarkdown();
  savedLiveSelection = null;
  if (currentViewMode === 'live') focusActiveEditor(Math.max(0, caretOffset));
}

function insertFormattingUniversal(prefix, suffix) {
  if (!savedLiveSelection) {
    restoreSavedTextareaSelection();
    insertFormatting(prefix, suffix);
    savedTextareaSelection = null;
    return;
  }

  const range = restoreSavedLiveSelection();
  if (!range) return;
  recordEditorState();
  const selectedText = range.toString();
  let node;

  if (prefix === '**') node = document.createElement('strong');
  else if (prefix === '*') node = document.createElement('em');
  else if (prefix === '~~') node = document.createElement('del');
  else if (prefix === '`') node = document.createElement('code');
  else if (prefix === '==') node = document.createElement('mark');
  else if (prefix === '[') {
    node = document.createElement('a');
    node.href = suffix === '](url)' ? 'url' : 'image-url';
  } else if (prefix === '![') {
    node = document.createElement('img');
    node.alt = selectedText || 'image';
    node.src = 'image-url';
  } else if (prefix.includes('```')) {
    node = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = selectedText;
    node.appendChild(code);
  } else if (prefix.includes('| Header 1')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>';
    node = wrapper.firstElementChild;
  } else if (prefix.includes('---')) {
    node = document.createElement('hr');
  } else {
    node = document.createTextNode(prefix + selectedText + suffix);
  }

  range.deleteContents();
  if (node.nodeType === Node.ELEMENT_NODE && !['IMG', 'HR', 'TABLE', 'PRE'].includes(node.tagName)) {
    node.textContent = selectedText;
  }
  range.insertNode(node);
  commitLiveFormatting();
}

function getLiveSelectionBlock(range) {
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  while (node && node.parentElement !== previewContent) {
    node = node.parentElement;
  }
  return node && node.parentElement === previewContent ? node : null;
}

function replaceElementTag(element, tagName) {
  const replacement = document.createElement(tagName);
  replacement.innerHTML = element.innerHTML;
  element.replaceWith(replacement);
  return replacement;
}

function insertLinePrefixUniversal(prefix) {
  if (!savedLiveSelection) {
    restoreSavedTextareaSelection();
    insertLinePrefix(prefix);
    savedTextareaSelection = null;
    return;
  }

  const range = restoreSavedLiveSelection();
  const block = range && getLiveSelectionBlock(range);
  if (!block) return;
  recordEditorState();

  const headingMatch = prefix.match(/^(#{1,6})\s$/);
  if (headingMatch) {
    replaceElementTag(block, `h${headingMatch[1].length}`);
  } else if (prefix === '> ') {
    replaceElementTag(block, 'blockquote');
  } else if (prefix === '- ' || prefix === '1. ') {
    const list = document.createElement(prefix === '- ' ? 'ul' : 'ol');
    const item = document.createElement('li');
    item.innerHTML = block.innerHTML;
    list.appendChild(item);
    block.replaceWith(list);
  }

  commitLiveFormatting();
}

function clearFormattingUniversal() {
  if (!savedLiveSelection) {
    restoreSavedTextareaSelection();
    recordEditorState();
    const ta = markdownTextarea;
    const text = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;
    const source = text.substring(lineStart, lineEnd);
    const cleared = source
      .replace(/^(?:#{1,6}\s+|>\s+|[-+*]\s+|\d+\.\s+)/gm, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|~~|==)(.*?)\1/g, '$2')
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1');
    ta.value = text.substring(0, lineStart) + cleared + text.substring(lineEnd);
    ta.selectionStart = lineStart;
    ta.selectionEnd = lineStart + cleared.length;
    ta.focus();
    isModified = true;
    unsavedIndicator.style.display = 'inline-block';
    updateStats();
    renderMarkdown();
    generateOutline();
    savedTextareaSelection = null;
    return;
  }

  const range = restoreSavedLiveSelection();
  const block = range && getLiveSelectionBlock(range);
  if (!block) return;
  recordEditorState();
  const paragraph = document.createElement('p');
  paragraph.textContent = block.textContent;
  block.replaceWith(paragraph);
  commitLiveFormatting();
}

// ============================================================
// insertLinePrefix: adds a prefix at the beginning of the current line
// (or each selected line). Used for headings, list markers, blockquotes.
// ============================================================
function insertLinePrefix(prefix) {
  const ta = markdownTextarea;
  recordEditorState();
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const text  = ta.value;

  // Find the start of the first selected line
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  // Find the end of the last selected line
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = text.length;

  const selectedLines = text.substring(lineStart, lineEnd).split('\n');
  const isHeading = /^#{1,6}\s$/.test(prefix);

  // Toggle: if ALL lines already have this prefix, remove it; otherwise add it
  const allHavePrefix = selectedLines.every(l => l.startsWith(prefix));
  const newLines = allHavePrefix
    ? selectedLines.map(l => l.slice(prefix.length))
    : selectedLines.map(l => prefix + (isHeading ? l.replace(/^#{1,6}\s+/, '') : l));

  const replacement = newLines.join('\n');
  ta.value = text.substring(0, lineStart) + replacement + text.substring(lineEnd);

  // Restore selection roughly
  const newSelStart = lineStart + (allHavePrefix ? Math.max(0, start - lineStart - prefix.length) : start - lineStart + prefix.length);
  ta.selectionStart = Math.max(lineStart, Math.min(newSelStart, lineStart + replacement.length));
  ta.selectionEnd   = lineStart + replacement.length;

  ta.focus();
  isModified = true;
  unsavedIndicator.style.display = 'inline-block';
  updateStats();
  clearTimeout(window._renderTimer);
  window._renderTimer = setTimeout(() => { renderMarkdown(); generateOutline(); }, 80);
}

// --- Sidebar Collapse / Expand Toggle ---
function toggleSidebar() {
  const isCollapsed = appSidebar.classList.toggle('collapsed');
  if (isCollapsed) {
    sidebarExpandHandle.style.display = 'flex';
  } else {
    sidebarExpandHandle.style.display = 'none';
  }
}

// --- View Modes Toggling ---
function setViewMode(mode) {
  clearSplitScrollSync();
  currentViewMode = mode;
  previewContainer.classList.toggle('live-view', mode === 'live');

  // Update UI Button Styles
  btnModeEdit.classList.toggle('active', mode === 'edit');
  btnModeSplit.classList.toggle('active', mode === 'split');
  btnModePreview.classList.toggle('active', mode === 'preview');
  btnModeLive.classList.toggle('active', mode === 'live');

  // Adjust display panels
  if (mode === 'edit') {
    cleanupLiveEditMode();
    editorContainer.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    previewContent.classList.remove('live-edit-mode');
    previewContent.contentEditable = "false";
  } else if (mode === 'split') {
    cleanupLiveEditMode();
    editorContainer.classList.remove('hidden');
    previewContainer.classList.remove('hidden');
    previewContent.classList.remove('live-edit-mode');
    previewContent.contentEditable = "false";
    renderMarkdown();
    requestAnimationFrame(() => scheduleSplitScrollSync(markdownTextarea, previewContainer));
  } else if (mode === 'preview') {
    cleanupLiveEditMode();
    editorContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    previewContent.classList.remove('live-edit-mode');
    previewContent.contentEditable = "false";
    renderMarkdown(); // Fresh parse for preview view
  } else if (mode === 'live') {
    editorContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    renderLiveEditMode();
  }

  requestAnimationFrame(updateLiveScrollControls);
  focusActiveEditor();
}

function updateLiveScrollControls() {
  if (!btnScrollTop || !btnScrollBottom) return;

  const maxScrollTop = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
  const isScrollable = maxScrollTop > 2;
  btnScrollTop.disabled = !isScrollable || previewContainer.scrollTop <= 2;
  btnScrollBottom.disabled = !isScrollable || previewContainer.scrollTop >= maxScrollTop - 2;
}

function getRecentItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_ITEMS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      item &&
      (item.type === 'file' || item.type === 'folder') &&
      typeof item.path === 'string' &&
      item.path.trim()
    ).slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

function saveRecentItems(items) {
  localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_ITEMS)));
  renderRecentItems();
}

function addRecentItem(type, itemPath) {
  if (!itemPath) return;
  const normalizedPath = itemPath.trim();
  const items = getRecentItems().filter(item =>
    !(item.type === type && item.path.toLowerCase() === normalizedPath.toLowerCase())
  );
  items.unshift({ type, path: normalizedPath, openedAt: Date.now() });
  saveRecentItems(items);
}

function removeRecentItem(type, itemPath) {
  const items = getRecentItems().filter(item =>
    !(item.type === type && item.path === itemPath)
  );
  saveRecentItems(items);
}

function closeRecentMenu() {
  if (!recentMenu || !btnRecent) return;
  recentMenu.classList.remove('open');
  btnRecent.setAttribute('aria-expanded', 'false');
}

function getContextCreationDirectory() {
  if (selectedIsDir && selectedPathForContextMenu) {
    return selectedPathForContextMenu;
  }
  return currentSidebarDir;
}

function getContextTargetPaths() {
  if (selectedPathForContextMenu && selectedFileTreePaths.has(selectedPathForContextMenu)) {
    return Array.from(selectedFileTreePaths);
  }
  return selectedPathForContextMenu ? [selectedPathForContextMenu] : [];
}

function updateFileContextMenuState(hasNodeTarget) {
  const targetPaths = getContextTargetPaths();
  const selectedCount = targetPaths.length;
  const isSingle = selectedCount === 1;
  const canCreateInTarget = selectedIsDir || !hasNodeTarget;

  ctxRefreshSidebar.style.display = currentSidebarDir ? 'flex' : 'none';
  ctxOpenItem.style.display = isSingle && hasNodeTarget ? 'flex' : 'none';
  ctxShowInFolder.style.display = isSingle && hasNodeTarget ? 'flex' : 'none';
  ctxCopyPath.style.display = selectedCount > 0 ? 'flex' : 'none';
  ctxCreateFile.style.display = canCreateInTarget ? 'flex' : 'none';
  ctxCreateFolder.style.display = canCreateInTarget ? 'flex' : 'none';
  ctxRenameItem.style.display = isSingle && hasNodeTarget ? 'flex' : 'none';
  ctxDeleteItem.style.display = selectedCount > 0 && hasNodeTarget ? 'flex' : 'none';
  ctxDeleteItem.innerHTML = `<i data-lucide="trash-2"></i> ${selectedCount > 1 ? `Delete ${selectedCount} Items` : 'Delete'}`;
}

function getPathDisplayName(itemPath) {
  const parts = itemPath.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || itemPath;
}

function renderRecentItems() {
  if (!recentList || !btnClearRecent) return;
  const items = getRecentItems();
  recentList.replaceChildren();
  btnClearRecent.disabled = items.length === 0;

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = 'No recent files or folders';
    recentList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-item';
    button.title = item.path;
    button.setAttribute('role', 'menuitem');

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', item.type === 'folder' ? 'folder' : 'file-text');

    const text = document.createElement('span');
    text.className = 'recent-item-text';

    const name = document.createElement('span');
    name.className = 'recent-item-name';
    name.textContent = getPathDisplayName(item.path);

    const itemPath = document.createElement('span');
    itemPath.className = 'recent-item-path';
    itemPath.textContent = item.path;

    text.append(name, itemPath);
    button.append(icon, text);
    button.addEventListener('click', () => openRecentItem(item));
    recentList.appendChild(button);
  });

  if (window.lucide) lucide.createIcons();
}

async function openRecentItem(item) {
  closeRecentMenu();

  if (item.type === 'folder') {
    const loaded = await loadSidebarDirectory(item.path);
    if (!loaded) {
      removeRecentItem(item.type, item.path);
      return;
    }
    currentSidebarDir = item.path;
    document.getElementById('btn-new-file-sidebar').style.display = 'flex';
    return;
  }

  const previousOffset = getActiveEditorOffset();
  if (!await confirmFileTransition(previousOffset)) return;

  const readResult = await window.electronAPI.readFile(item.path);
  if (!readResult.success) {
    removeRecentItem(item.type, item.path);
    alert(`The recent file is no longer available:\n${item.path}\n\n${readResult.error}`);
    focusActiveEditor(previousOffset);
    return;
  }

  loadFile(item.path, readResult.content, readResult.fileName);
}

// --- Formatting Helpers ---
function insertFormatting(prefix, suffix) {
  recordEditorState();
  const start = markdownTextarea.selectionStart;
  const end = markdownTextarea.selectionEnd;
  const text = markdownTextarea.value;
  const selectedText = text.substring(start, end);

  const replacement = prefix + selectedText + suffix;
  markdownTextarea.value = text.substring(0, start) + replacement + text.substring(end);

  // Reset cursor selection to encompass formatting
  markdownTextarea.focus();
  markdownTextarea.selectionStart = start + prefix.length;
  markdownTextarea.selectionEnd = start + prefix.length + selectedText.length;

  // Trigger update
  isModified = true;
  unsavedIndicator.style.display = 'inline-block';
  updateStats();
  if (currentViewMode === 'live') {
    renderLiveEditMode();
  } else {
    renderMarkdown();
  }
}

// --- Stats Generator ---
function updateStats() {
  const text = markdownTextarea.value;
  const trimmedText = text.trim();
  const words = trimmedText ? trimmedText.split(/\s+/).filter(w => w.length > 0).length : 0;

  // Count Chinese characters (excluding spaces/newlines)
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCharCount = chineseChars ? chineseChars.length : 0;

  const characters = text.length;
  const noSpaceCharacters = text.replace(/\s/g, '').length;

  // Average reading speed: 200 words per minute
  const readingTime = Math.ceil(words / 200);

  wordCountSpan.innerText = `${words} word${words === 1 ? '' : 's'}`;
  if (chineseCharCountSpan) {
    chineseCharCountSpan.innerText = `${chineseCharCount} 汉字`;
  }
  if (charNoSpacesCountSpan) {
    charNoSpacesCountSpan.innerText = `${noSpaceCharacters} char${noSpaceCharacters === 1 ? '' : 's'} (no spaces)`;
  }
  charCountSpan.innerText = `${characters} char${characters === 1 ? '' : 's'}`;
  readTimeSpan.innerText = `${readingTime} min read`;
}

// --- Markdown Renderer ---
function renderMarkdown() {
  const markdownText = markdownTextarea.value;

  // Custom marked options for Typora-like rendering (GFM style)
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true,
    mangle: false
  });

  const rawHtml = marked.parse(markdownText);
  // Sanitize to prevent scripts running inside preview
  const safeHtml = DOMPurify.sanitize(rawHtml);

  previewContent.innerHTML = safeHtml;
}

// --- Document Outline Generator ---
function getMarkdownHeaders() {
  const text = markdownTextarea.value;
  const lines = text.split('\n');
  const headers = [];

  // Simple regex to parse headings while writing
  const headerRegex = /^(#{1,6})\s+(.+)$/;

  lines.forEach((line, index) => {
    const match = line.match(headerRegex);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2],
        lineIndex: index
      });
    }
  });

  return headers;
}

function generateOutline() {
  const headers = getMarkdownHeaders();
  renderLiveHeadingNav(headers);

  if (headers.length === 0) {
    outlineView.innerHTML = `
      <div class="outline-placeholder">
        <p>No headers found in document</p>
      </div>
    `;
    return;
  }

  let outlineHtml = '';
  headers.forEach(header => {
    outlineHtml += `
      <a class="outline-item h${header.level}" data-line="${header.lineIndex}">
        ${header.text}
      </a>
    `;
  });

  outlineView.innerHTML = outlineHtml;

  // Outline navigation click handlers
  outlineView.querySelectorAll('.outline-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const lineIndex = parseInt(e.target.getAttribute('data-line'));
      if (currentViewMode === 'live') {
        scrollToLiveHeading(lineIndex);
      } else {
        scrollToLine(lineIndex);
      }
    });
  });
}

function getLiveHeadingNavLabel(text) {
  const normalizedText = (text || '').trim();
  return normalizedText.length > 15
    ? `${normalizedText.slice(0, 15)}...`
    : normalizedText;
}

function renderLiveHeadingNav(headers) {
  if (!liveHeadingNav) return;
  liveHeadingNav.replaceChildren();

  if (headers.length === 0) {
    liveHeadingNav.classList.add('empty');
    liveHeadingNav.style.transform = '';
    return;
  }

  liveHeadingNav.classList.remove('empty');
  headers.forEach((header) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `live-heading-nav-item h${header.level}`;
    button.dataset.line = String(header.lineIndex);
    button.title = header.text;
    button.textContent = getLiveHeadingNavLabel(header.text);
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => scrollToLiveHeading(header.lineIndex));
    liveHeadingNav.appendChild(button);
  });
  updateLiveHeadingNavPosition();
}

function updateLiveHeadingNavPosition() {
  if (!liveHeadingNav || currentViewMode !== 'live' || liveHeadingNav.classList.contains('empty')) return;
  liveHeadingNav.style.transform = `translateY(${previewContainer.scrollTop}px)`;
}

function scrollToLine(lineIndex) {
  const text = markdownTextarea.value;
  const lines = text.split('\n');

  // Calculate total characters up to the target line
  let charIndex = 0;
  for (let i = 0; i < lineIndex; i++) {
    charIndex += lines[i].length + 1; // +1 for the newline character
  }

  markdownTextarea.focus();
  markdownTextarea.selectionStart = charIndex;
  markdownTextarea.selectionEnd = charIndex;

  // Scroll to cursor
  const textareaHeight = markdownTextarea.clientHeight;
  // ~25.5px line height
  markdownTextarea.scrollTop = (lineIndex * 25.5) - (textareaHeight / 4);
}

function scrollToLiveHeading(lineIndex) {
  if (currentViewMode !== 'live') {
    scrollToLine(lineIndex);
    return;
  }

  const heading = Array.from(previewContent.querySelectorAll('h1, h2, h3, h4, h5, h6'))[getLiveHeadingIndexForLine(lineIndex)];
  if (!heading) {
    scrollToLine(lineIndex);
    return;
  }

  const targetTop = heading.offsetTop - Math.max(12, previewContainer.clientHeight * 0.12);
  previewContainer.scrollTo({ top: Math.max(0, targetTop) });
  requestAnimationFrame(() => updateActiveLiveHeading(heading));
}

function getLiveHeadingIndexForLine(lineIndex) {
  const headers = getMarkdownHeaders();
  return headers.findIndex((header) => header.lineIndex === lineIndex);
}

function updateActiveLiveHeading(activeHeading = null) {
  if (!liveHeadingNav || currentViewMode !== 'live') return;
  const headings = Array.from(previewContent.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const headerButtons = Array.from(liveHeadingNav.querySelectorAll('.live-heading-nav-item'));
  if (headings.length === 0 || headerButtons.length === 0) return;

  let activeIndex = activeHeading ? headings.indexOf(activeHeading) : -1;
  if (activeIndex === -1) {
    const threshold = previewContainer.scrollTop + Math.max(24, previewContainer.clientHeight * 0.16);
    for (let index = headings.length - 1; index >= 0; index--) {
      if (headings[index].offsetTop <= threshold) {
        activeIndex = index;
        break;
      }
    }
    if (activeIndex === -1) activeIndex = 0;
  }

  headerButtons.forEach((button, index) => {
    button.classList.toggle('active', index === activeIndex);
  });
}

// --- File Operations ---

let unsavedPromptResolve = null;

function resolveUnsavedPrompt(choice) {
  if (!unsavedPromptResolve) return;
  const resolve = unsavedPromptResolve;
  unsavedPromptResolve = null;
  unsavedModal.style.display = 'none';
  resolve(choice);
}

function showUnsavedPrompt() {
  if (!isModified) return Promise.resolve('discard');
  unsavedModal.style.display = 'flex';
  return new Promise((resolve) => {
    unsavedPromptResolve = resolve;
    requestAnimationFrame(() => btnUnsavedSave.focus({ preventScroll: true }));
  });
}

async function confirmFileTransition(previousOffset) {
  if (!isModified) return true;
  const choice = await showUnsavedPrompt();
  if (choice === 'cancel') {
    focusActiveEditor(previousOffset);
    return false;
  }
  if (choice === 'save') {
    const saved = await saveFile();
    if (!saved) {
      focusActiveEditor(previousOffset);
      return false;
    }
  }
  return true;
}

// 1. New File
async function newFile() {
  const previousOffset = getActiveEditorOffset();
  if (!await confirmFileTransition(previousOffset)) return;

  currentFilePath = null;
  markdownTextarea.value = '';
  resetEditorHistory();
  originalContent = '';
  isModified = false;
  unsavedIndicator.style.display = 'none';
  currentFilename.innerText = 'Untitled.md';
  currentFilepathStatus.innerText = 'New File';

  updateStats();
  if (currentViewMode === 'live') {
    renderLiveEditMode();
  } else {
    renderMarkdown();
  }
  generateOutline();
  focusActiveEditor(0);
}

// 2. Open File
async function openFile() {
  const previousOffset = getActiveEditorOffset();
  if (!await confirmFileTransition(previousOffset)) return;

  const fileData = await window.electronAPI.openFile();
  if (fileData) {
    loadFile(fileData.filePath, fileData.content, fileData.fileName);
    addRecentItem('file', fileData.filePath);
  } else {
    focusActiveEditor(previousOffset);
  }
}

function loadFile(filePath, content, fileName) {
  currentFilePath = filePath;
  markdownTextarea.value = content;
  resetEditorHistory();
  originalContent = content;
  isModified = false;
  unsavedIndicator.style.display = 'none';

  currentFilename.innerText = fileName;
  currentFilepathStatus.innerText = filePath;

  // Highlight active file in sidebar if it exists
  document.querySelectorAll('.tree-node.file').forEach(node => {
    if (node.getAttribute('data-path') === filePath) {
      node.classList.add('active');
    } else {
      node.classList.remove('active');
    }
  });

  updateStats();
  if (currentViewMode === 'live') {
    renderLiveEditMode();
  } else {
    renderMarkdown();
  }
  generateOutline();
  focusActiveEditor(0);
}

// 3. Save File
async function saveFile() {
  if (currentViewMode === 'live') {
    initTurndown();
    syncLiveContentToTextarea();
  }

  const content = markdownTextarea.value;
  const previousOffset = getActiveEditorOffset();

  if (currentFilePath) {
    const result = await window.electronAPI.writeFile(currentFilePath, content);
    if (result.success) {
      originalContent = content;
      isModified = false;
      unsavedIndicator.style.display = 'none';
      focusActiveEditor(previousOffset);
      return true;
    } else {
      alert(`Error saving file: ${result.error}`);
      focusActiveEditor(previousOffset);
      return false;
    }
  } else {
    // Save As
    const newPath = await window.electronAPI.saveFileAs();
    if (newPath) {
      const result = await window.electronAPI.writeFile(newPath, content);
      if (result.success) {
        currentFilePath = newPath;
        originalContent = content;
        isModified = false;
        unsavedIndicator.style.display = 'none';

        // Extract filename
        const parts = newPath.split(/[/\\]/);
        const fileName = parts[parts.length - 1];
        currentFilename.innerText = fileName;
        currentFilepathStatus.innerText = newPath;

        // If sidebar directory is open, refresh it to include the new file
        if (currentSidebarDir) {
          loadSidebarDirectory(currentSidebarDir);
        }
        focusActiveEditor(previousOffset);
        return true;
      } else {
        alert(`Error saving file: ${result.error}`);
        focusActiveEditor(previousOffset);
        return false;
      }
    } else {
      focusActiveEditor(previousOffset);
      return false;
    }
  }
}

// 4. Open Folder / Sidebar Directory View
let currentSidebarDir = null;
async function openFolder() {
  const previousOffset = getActiveEditorOffset();
  const folderData = await window.electronAPI.openDirectory();
  if (folderData) {
    const loaded = await loadSidebarDirectory(folderData.dirPath);
    if (!loaded) {
      focusActiveEditor(previousOffset);
      return;
    }
    currentSidebarDir = folderData.dirPath;
    addRecentItem('folder', folderData.dirPath);
    // Show 'New File' button in sidebar header once folder is open
    document.getElementById('btn-new-file-sidebar').style.display = 'flex';
  }
  focusActiveEditor(previousOffset);
}

async function refreshSidebarDirectory() {
  if (!currentSidebarDir) return false;
  return loadSidebarDirectory(currentSidebarDir);
}

async function openContextMenuItem() {
  const targetPath = selectedPathForContextMenu;
  if (!targetPath) return;

  if (selectedIsDir) {
    if (openDirectories.has(targetPath)) {
      openDirectories.delete(targetPath);
    } else {
      openDirectories.add(targetPath);
    }
    if (currentSidebarDir) await loadSidebarDirectory(currentSidebarDir);
    return;
  }

  await openSidebarFile(targetPath);
}

// Refresh/Load Directory Tree
async function loadSidebarDirectory(dirPath) {
  const result = await window.electronAPI.listMarkdown(dirPath);
  if (result.success) {
    sidebarFilesData = result.files;
    const currentSort = sortDropdown ? sortDropdown.value : (localStorage.getItem('sidebar-sort-by') || 'name');
    const sortedTree = sortFiles(sidebarFilesData, currentSort);
    visibleFilePaths = collectVisibleFilePaths(sortedTree);
    pruneSelectedFileTreePaths();
    renderDirectoryTree(sortedTree, dirTree);
    if (paneSortContainer) {
      paneSortContainer.style.display = 'block';
    }
    if (btnRefreshSidebar) {
      btnRefreshSidebar.style.display = 'flex';
    }
    return true;
  } else {
    sidebarFilesData = [];
    visibleFilePaths = [];
    selectedFileTreePaths.clear();
    dirTree.innerHTML = `<div class="tree-placeholder"><p>Error loading folder: ${result.error}</p></div>`;
    if (paneSortContainer) {
      paneSortContainer.style.display = 'none';
    }
    if (btnRefreshSidebar) {
      btnRefreshSidebar.style.display = 'none';
    }
    alert(`Error loading folder: ${result.error}`);
    return false;
  }
}

function collectVisibleFilePaths(files) {
  const paths = [];
  const walk = (items) => {
    items.forEach((item) => {
      if (item.isDirectory) {
        if (openDirectories.has(item.path) && item.children) {
          walk(item.children);
        }
        return;
      }
      paths.push(item.path);
    });
  };
  walk(files || []);
  return paths;
}

function refreshVisibleFilePathsFromData() {
  const currentSort = sortDropdown ? sortDropdown.value : (localStorage.getItem('sidebar-sort-by') || 'name');
  visibleFilePaths = collectVisibleFilePaths(sortFiles(sidebarFilesData, currentSort));
  pruneSelectedFileTreePaths();
}

function pruneSelectedFileTreePaths() {
  const available = new Set(visibleFilePaths);
  selectedFileTreePaths = new Set(Array.from(selectedFileTreePaths).filter((itemPath) => available.has(itemPath)));
  if (lastSelectedFilePath && !available.has(lastSelectedFilePath)) {
    lastSelectedFilePath = selectedFileTreePaths.size ? Array.from(selectedFileTreePaths).at(-1) : null;
  }
}

function updateTreeSelectionClasses() {
  document.querySelectorAll('.tree-node.file').forEach((node) => {
    node.classList.toggle('selected', selectedFileTreePaths.has(node.getAttribute('data-path')));
  });
}

function updateFileTreeSelection(filePath, event) {
  if (event.shiftKey && lastSelectedFilePath) {
    const startIndex = visibleFilePaths.indexOf(lastSelectedFilePath);
    const endIndex = visibleFilePaths.indexOf(filePath);
    if (startIndex !== -1 && endIndex !== -1) {
      const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      selectedFileTreePaths = new Set(visibleFilePaths.slice(from, to + 1));
    } else {
      selectedFileTreePaths = new Set([filePath]);
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedFileTreePaths.has(filePath)) {
      selectedFileTreePaths.delete(filePath);
    } else {
      selectedFileTreePaths.add(filePath);
    }
    lastSelectedFilePath = filePath;
  } else {
    selectedFileTreePaths = new Set([filePath]);
    lastSelectedFilePath = filePath;
  }

  updateTreeSelectionClasses();
}

async function openSidebarFile(filePath) {
  const previousOffset = getActiveEditorOffset();
  if (!await confirmFileTransition(previousOffset)) return false;

  const readResult = await window.electronAPI.readFile(filePath);
  if (readResult.success) {
    loadFile(filePath, readResult.content, readResult.fileName || filePath.split(/[/\\]/).pop());
    return true;
  }

  alert(`Error reading file: ${readResult.error}`);
  focusActiveEditor(previousOffset);
  return false;
}

// Sort Directory Tree recursively
function sortFiles(files, sortBy) {
  if (!files || !Array.isArray(files)) return [];

  // Create copies recursively to avoid mutating cached tree state in-place
  const sorted = files.map(file => {
    const copy = { ...file };
    if (copy.isDirectory && copy.children) {
      copy.children = sortFiles(copy.children, sortBy);
    }
    return copy;
  });

  return sorted.sort((a, b) => {
    // Keep directories first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let compareVal = 0;
    if (sortBy === 'name') {
      compareVal = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (sortBy === 'birthtime') {
      compareVal = (b.birthtime || 0) - (a.birthtime || 0);
    } else if (sortBy === 'mtime') {
      compareVal = (b.mtime || 0) - (a.mtime || 0);
    } else if (sortBy === 'size') {
      compareVal = (b.size || 0) - (a.size || 0);
    }

    // Stable sort fallback to name sorting
    if (compareVal === 0) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    return compareVal;
  });
}

// Sidebar New File shortcut button
const btnNewFileSidebar = document.getElementById('btn-new-file-sidebar');
if (btnNewFileSidebar) {
  btnNewFileSidebar.addEventListener('click', () => {
    if (currentSidebarDir) {
      showInputDialog('Create New File', 'Untitled', 'Enter filename', async (val) => {
        if (!val) return false;
        let formattedName = val;
        if (!formattedName.endsWith('.md') && !formattedName.endsWith('.markdown') && !formattedName.endsWith('.txt')) {
          formattedName += '.md';
        }
        const result = await window.electronAPI.createInDir(currentSidebarDir, formattedName);
        if (result.success) {
          await loadSidebarDirectory(currentSidebarDir);
          loadFile(result.filePath, '', result.fileName);
          return true;
        } else {
          alert(`Error creating file: ${result.error}`);
          return false;
        }
      });
    } else {
      newFile();
    }
  });
}

function renderDirectoryTree(files, container, depth = 0) {
  // Clear container only on root call
  if (depth === 0) {
    container.innerHTML = '';
  }

  if (files.length === 0 && depth === 0) {
    container.innerHTML = `
      <div class="tree-placeholder">
        <i data-lucide="info"></i>
        <p>No markdown files found in directory</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  files.forEach(file => {
    const node = document.createElement('div');
    node.className = `tree-node ${file.isDirectory ? 'directory' : 'file'} ${(!file.isDirectory && file.isEmpty) ? 'empty-file' : ''}`;
    node.setAttribute('data-path', file.path);

    // Match styles
    if (currentFilePath === file.path) {
      node.classList.add('active');
    }
    if (!file.isDirectory && selectedFileTreePaths.has(file.path)) {
      node.classList.add('selected');
    }

    // Set indentation
    node.style.paddingLeft = `${12 + depth * 16}px`;

    // Inner icon & text
    let iconName = file.isDirectory ? 'folder' : 'file-text';
    let chevronName = 'chevron-right';
    if (file.isDirectory && openDirectories.has(file.path)) {
      iconName = 'folder-open';
      chevronName = 'chevron-down';
    }

    node.innerHTML = file.isDirectory
      ? `
        <i class="node-chevron" data-lucide="${chevronName}"></i>
        <i class="node-icon" data-lucide="${iconName}"></i>
        <span class="node-name">${file.name}</span>
      `
      : `
        <i class="node-spacer" data-lucide="minus"></i>
        <i class="node-icon" data-lucide="${iconName}"></i>
        <span class="node-name">${file.name}</span>
      `;

    container.appendChild(node);

    // Event click handlers
    if (file.isDirectory) {
      makeTreeNodeDraggable(node, file);

      // Sub-node container
      const subContainer = document.createElement('div');
      subContainer.className = 'tree-sub-container';
      subContainer.style.display = openDirectories.has(file.path) ? 'block' : 'none';
      container.appendChild(subContainer);

      // Render children recursively
      if (file.children && file.children.length > 0) {
        renderDirectoryTree(file.children, subContainer, depth + 1);
      }

      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = openDirectories.has(file.path);
        if (isOpen) {
          openDirectories.delete(file.path);
          subContainer.style.display = 'none';
          node.querySelector('.node-chevron').setAttribute('data-lucide', 'chevron-right');
          node.querySelector('.node-icon').setAttribute('data-lucide', 'folder');
        } else {
          openDirectories.add(file.path);
          subContainer.style.display = 'block';
          node.querySelector('.node-chevron').setAttribute('data-lucide', 'chevron-down');
          node.querySelector('.node-icon').setAttribute('data-lucide', 'folder-open');
        }
        refreshVisibleFilePathsFromData();
        updateTreeSelectionClasses();
        lucide.createIcons();
      });

      // Directory drag and drop dropzone
      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.classList.add('drag-over');
      });
      node.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        node.classList.remove('drag-over');
      });
      node.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.classList.remove('drag-over');

        const transferPaths = e.dataTransfer.getData('application/x-markdown-edit-paths');
        const fallbackPath = e.dataTransfer.getData('text/plain');
        let srcPaths = [fallbackPath].filter(Boolean);
        if (transferPaths) {
          try {
            const parsedPaths = JSON.parse(transferPaths);
            if (Array.isArray(parsedPaths)) {
              srcPaths = parsedPaths.filter(Boolean);
            }
          } catch {
            srcPaths = [fallbackPath].filter(Boolean);
          }
        }
        const destDir = file.path;

        if (srcPaths.length > 0 && !srcPaths.includes(destDir)) {
          const result = await window.electronAPI.moveItems(srcPaths, destDir);
          if (result.moved && result.moved.length > 0) {
            result.moved.forEach((movedItem) => {
              if (movedItem.oldPath === currentFilePath) {
                currentFilePath = movedItem.newPath;
                currentFilepathStatus.innerText = movedItem.newPath;
              }
            });
            selectedFileTreePaths = new Set(result.moved.map((movedItem) => movedItem.newPath));
            lastSelectedFilePath = result.moved.at(-1).newPath;
          }
          if (currentSidebarDir) await loadSidebarDirectory(currentSidebarDir);
          if (!result.success) {
            const details = result.errors && result.errors.length
              ? result.errors.map((item) => `${item.path}: ${item.error}`).join('\n')
              : result.error;
            alert(`Some items could not be moved:\n${details}`);
          }
        }
      });
    } else {
      makeTreeNodeDraggable(node, file);

      node.addEventListener('click', async (e) => {
        e.stopPropagation();
        updateFileTreeSelection(file.path, e);
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          return;
        }
        await openSidebarFile(file.path);
      });
    }
  });

  // Re-create icons for new elements
  lucide.createIcons();
}

function makeTreeNodeDraggable(node, file) {
  node.draggable = true;
  node.addEventListener('dragstart', (e) => {
    e.stopPropagation();

    let paths = [file.path];
    if (!file.isDirectory) {
      if (!selectedFileTreePaths.has(file.path)) {
        selectedFileTreePaths = new Set([file.path]);
        lastSelectedFilePath = file.path;
        updateTreeSelectionClasses();
      }
      paths = Array.from(selectedFileTreePaths);
    }

    e.dataTransfer.setData('application/x-markdown-edit-paths', JSON.stringify(paths));
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.effectAllowed = 'move';

    node.classList.add('dragging');
    document.querySelectorAll('.tree-node.file.selected').forEach((selectedNode) => {
      selectedNode.classList.add('dragging');
    });
  });
  node.addEventListener('dragend', () => {
    document.querySelectorAll('.tree-node.dragging').forEach((draggingNode) => {
      draggingNode.classList.remove('dragging');
    });
  });
}

// --- Export Functions ---
async function exportPdf() {
  // Grab the rendered HTML inside previewContent
  const htmlContent = previewContent.innerHTML;
  if (!htmlContent || htmlContent.trim() === '') {
    alert('Document is empty, nothing to export.');
    return;
  }

  // Derive target file name
  let defaultName = 'Untitled.pdf';
  if (currentFilePath) {
    const parts = currentFilePath.split(/[/\\]/);
    const fileNameWithoutExt = parts[parts.length - 1].replace(/\.[^/.]+$/, "");
    defaultName = `${fileNameWithoutExt}.pdf`;
  }

  const result = await window.electronAPI.exportPdf(htmlContent, defaultName);
  if (result.success) {
    alert(`Successfully exported PDF to: ${result.filePath}`);
  } else if (!result.canceled) {
    alert(`Failed to export PDF: ${result.error}`);
  }
}

async function exportHtml() {
  const htmlContent = previewContent.innerHTML;
  if (!htmlContent || htmlContent.trim() === '') {
    alert('Document is empty, nothing to export.');
    return;
  }

  let defaultName = 'Untitled.html';
  if (currentFilePath) {
    const parts = currentFilePath.split(/[/\\]/);
    const fileNameWithoutExt = parts[parts.length - 1].replace(/\.[^/.]+$/, "");
    defaultName = `${fileNameWithoutExt}.html`;
  }

  const result = await window.electronAPI.exportHtml(htmlContent, defaultName);
  if (result.success) {
    alert(`Successfully exported HTML to: ${result.filePath}`);
  } else if (!result.canceled) {
    alert(`Failed to export HTML: ${result.error}`);
  }
}

// --- Live Edit Mode Helpers (contenteditable + Turndown) ---

let turndownService = null;

function initTurndown() {
  if (!turndownService && typeof TurndownService !== 'undefined') {
    turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });

    // Avoid escaping markdown characters
    turndownService.escape = function (string) {
      return string;
    };

    // Convert each HTML table once. Handling tr/td independently causes body
    // rows to be mistaken for headers and repeatedly reintroduces | --- | rows.
    turndownService.addRule('tables', {
      filter: 'table',
      replacement: function (_content, node) {
        return tableElementToMarkdown(node);
      }
    });

  }
}

function normalizeTableCellMarkdown(cell) {
  const markdown = turndownService.turndown(cell.innerHTML || cell.textContent || '');
  return markdown
    .replace(/\r?\n+/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}

function isMarkdownDividerCell(text) {
  return /^:?-{3,}:?$/.test((text || '').trim());
}

function tableElementToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll('tr'))
    .map((row) => {
      const cells = Array.from(row.children).filter((cell) => cell.matches('th, td'));
      return {
        isHeader: row.closest('thead') !== null || cells.some((cell) => cell.tagName === 'TH'),
        cells: cells.map(normalizeTableCellMarkdown)
      };
    })
    .filter((row) => row.cells.length > 0)
    .filter((row) => !row.cells.every(isMarkdownDividerCell));

  if (rows.length === 0) return '';

  const columnCount = Math.max(...rows.map((row) => row.cells.length));
  const normalizeRow = (row) => {
    const cells = row.cells.slice();
    while (cells.length < columnCount) cells.push('');
    return `| ${cells.map((cell) => cell || ' ').join(' | ')} |`;
  };

  const explicitHeaderIndex = rows.findIndex((row) => row.isHeader);
  const headerIndex = explicitHeaderIndex >= 0 ? explicitHeaderIndex : 0;
  const header = rows[headerIndex];
  const bodyRows = rows.filter((_, index) => index !== headerIndex);
  const divider = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;

  return `\n\n${[normalizeRow(header), divider, ...bodyRows.map(normalizeRow)].join('\n')}\n\n`;
}

// --- Cursor preservation utilities for contentEditable re-render ---

// Get the character offset of the caret within a contentEditable container
function getCaretCharOffset(container) {
  const selection = window.getSelection();
  if (!selection.rangeCount || !container.contains(selection.anchorNode)) return -1;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

// Restore the caret to a specific character offset within a contentEditable container
function setCaretCharOffset(container, offset) {
  if (offset < 0) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let node;
  while ((node = walker.nextNode())) {
    const nodeLen = node.textContent.length;
    if (currentOffset + nodeLen >= offset) {
      const range = document.createRange();
      range.setStart(node, Math.min(offset - currentOffset, nodeLen));
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    currentOffset += nodeLen;
  }

  // An empty live document contains only <p><br></p>, so there is no text
  // node for the walker to target. Put the caret inside its first block.
  if (offset === 0 && container.firstElementChild) {
    const range = document.createRange();
    range.setStart(container.firstElementChild, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  // If offset exceeds content length, place cursor at end
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// --- Block-level rendering: only re-render when user CLICKS into a different block ---
// Keyboard actions (Enter, arrows, Ctrl+A) never trigger re-render, avoiding
// cursor jumps, empty-line loss, and selection reset issues.

let lastActiveBlockIndex = -1;
let modifiedBlockIndices = new Set();  // Track which blocks were actually edited by the user

// Clean up live edit mode listeners when switching away
function cleanupLiveEditMode() {
  previewContent.removeEventListener('input', handleLiveEditInput);
  previewContent.removeEventListener('beforeinput', handleLiveBeforeInput);
  previewContent.removeEventListener('mouseup', handleLiveMouseUp);
  previewContent.removeEventListener('blur', handleLiveEditBlur);
  lastActiveBlockIndex = -1;
  modifiedBlockIndices.clear();
}

// Find the index of the top-level block element containing the cursor
function getCurrentBlockIndex() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return -1;
  let node = sel.anchorNode;
  if (!node || !previewContent.contains(node)) return -1;
  // Walk up to find the direct child of previewContent
  while (node && node.parentNode !== previewContent) {
    node = node.parentNode;
  }
  if (!node) return -1;
  return Array.from(previewContent.children).indexOf(node);
}

// Parse markdown to HTML while preserving empty lines that would otherwise
// be collapsed by marked.parse() (standard Markdown ignores extra blank lines)
function parseMarkdownPreservingEmptyLines(markdown) {
  if (!markdown.trim()) return '<p><br></p>';

  // Detect runs of 3+ newlines in older files and upgrade them to explicit
  // HTML paragraphs. Markdown normally collapses these runs.
  const processed = markdown.replace(/\n{3,}/g, (match) => {
    const extraBlanks = Math.max(1, Math.floor((match.length - 1) / 2));
    let result = '\n\n';
    for (let i = 0; i < extraBlanks; i++) {
      result += `${EMPTY_LINE_MARKDOWN}\n\n`;
    }
    return result;
  });

  let html = marked.parse(processed);
  // Normalize legacy placeholders to editable blank paragraphs.
  html = html.replace(/<p>&nbsp;<\/p>/g, '<p><br></p>');
  html = html.replace(/<p>\u00A0<\/p>/g, '<p><br></p>');
  return DOMPurify.sanitize(html);
}

function handleEmptyLiveAreaMouseDown(event) {
  if (currentViewMode !== 'live' || markdownTextarea.value.trim() !== '') return;
  if (event.target.closest('.live-scroll-controls')) return;
  if (event.target.closest('.live-heading-nav')) return;

  event.preventDefault();
  previewContent.focus({ preventScroll: true });
  setCaretCharOffset(previewContent, 0);
}

function renderLiveEditMode() {
  initTurndown();
  const markdownText = markdownTextarea.value;
  previewContent.classList.add('live-edit-mode');

  // Enable contenteditable for the entire area
  previewContent.contentEditable = "true";

  // Parse Markdown to HTML, preserving empty lines
  previewContent.innerHTML = parseMarkdownPreservingEmptyLines(markdownText);

  // Reset block tracking
  lastActiveBlockIndex = -1;
  modifiedBlockIndices.clear();

  // Bind events (remove first to avoid duplicates)
  previewContent.removeEventListener('input', handleLiveEditInput);
  previewContent.addEventListener('input', handleLiveEditInput);

  previewContent.removeEventListener('beforeinput', handleLiveBeforeInput);
  previewContent.addEventListener('beforeinput', handleLiveBeforeInput);

  previewContent.removeEventListener('mouseup', handleLiveMouseUp);
  previewContent.addEventListener('mouseup', handleLiveMouseUp);

  previewContent.removeEventListener('blur', handleLiveEditBlur);
  previewContent.addEventListener('blur', handleLiveEditBlur);

  requestAnimationFrame(updateLiveScrollControls);
  renderLiveHeadingNav(getMarkdownHeaders());
  requestAnimationFrame(() => {
    updateLiveHeadingNavPosition();
    updateActiveLiveHeading();
  });
}

// Re-render ONLY the single block that was just left — all other blocks
// (including empty paragraphs) remain untouched in the DOM
function reRenderSingleBlock(blockElement) {
  const rawText = blockElement.textContent;
  if (!rawText.trim()) return; // Don't touch empty blocks

  // Use Turndown to convert the block's HTML back to Markdown first,
  // preserving structure (lists, headings, code blocks, etc.)
  // Then re-parse that Markdown to get properly rendered HTML.
  const blockMarkdown = turndownService.turndown(blockElement.outerHTML);
  if (!blockMarkdown.trim()) return;

  const html = DOMPurify.sanitize(marked.parse(blockMarkdown));
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Replace the old block with new rendered element(s)
  const parent = blockElement.parentNode;
  const nextSibling = blockElement.nextSibling;
  parent.removeChild(blockElement);
  while (temp.firstChild) {
    parent.insertBefore(temp.firstChild, nextSibling);
  }
}

// Re-render only when the user CLICKS into a different block (not on keyboard)
function handleLiveMouseUp() {
  requestAnimationFrame(() => {
    if (currentViewMode !== 'live') return;

    const currentIndex = getCurrentBlockIndex();
    if (currentIndex === -1) return;

    if (lastActiveBlockIndex !== -1 && currentIndex !== lastActiveBlockIndex) {
      // Only re-render the previous block if user actually typed in it
      if (modifiedBlockIndices.has(lastActiveBlockIndex)) {
        const prevBlock = previewContent.children[lastActiveBlockIndex];
        if (prevBlock) {
          reRenderSingleBlock(prevBlock);
        }
        modifiedBlockIndices.delete(lastActiveBlockIndex);
      }
      syncLiveContentToTextarea();
      lastActiveBlockIndex = getCurrentBlockIndex();
    } else {
      lastActiveBlockIndex = currentIndex;
    }
  });
}

// Sync contentEditable HTML → markdown textarea (no re-render)
function isEmptyLiveBlock(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.nodeName !== 'P' && node.nodeName !== 'DIV') return false;

  const clone = node.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.remove());
  const text = (clone.textContent || '').replace(/\u00a0/g, '').trim();
  const hasVisibleMedia = Boolean(clone.querySelector('img, video, audio, iframe, table, hr, input, svg, canvas'));
  return text === '' && !hasVisibleMedia;
}

function serializeLiveEditMarkdown() {
  const blocks = Array.from(previewContent.childNodes).map(node => {
    if (isEmptyLiveBlock(node)) {
      return EMPTY_LINE_MARKDOWN;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      return turndownService.turndown(node.outerHTML).trim();
    }

    return '';
  }).filter(Boolean);

  // A single browser-created empty paragraph means the document is empty.
  if (blocks.length === 1 && blocks[0] === EMPTY_LINE_MARKDOWN) {
    return '';
  }

  return blocks.join('\n\n');
}

function syncLiveContentToTextarea() {
  if (!turndownService) return;

  const markdown = serializeLiveEditMarkdown();

  if (markdownTextarea.value !== markdown) {
    markdownTextarea.value = markdown;
    isModified = true;
    unsavedIndicator.style.display = 'inline-block';
    updateStats();
    generateOutline();
  }
}

function handleLiveEditInput() {
  // Only sync HTML→Markdown, do NOT re-render while user is typing
  syncLiveContentToTextarea();
  requestAnimationFrame(updateLiveScrollControls);
  // Mark the current block as modified so it gets re-rendered when user clicks away
  const idx = getCurrentBlockIndex();
  if (idx !== -1) {
    modifiedBlockIndices.add(idx);
  }
}

function handleLiveBeforeInput(e) {
  if (!isRestoringHistory && !(e.inputType || '').startsWith('history')) {
    recordEditorState();
  }
}

function handleLiveEditBlur() {
  const cursorSelection = window.getSelection();
  if (!previewContent.contains(cursorSelection.anchorNode)) {
    syncLiveContentToTextarea();
    renderLiveEditMode();
  }
}

// --- Custom Input Modal Dialog Helper ---
let currentModalCallback = null;
let isInputModalSubmitting = false;

function closeInputDialog() {
  inputModal.style.display = 'none';
  currentModalCallback = null;
  isInputModalSubmitting = false;
  btnModalConfirm.disabled = false;
  btnModalCancel.disabled = false;
}

async function submitInputDialog() {
  if (isInputModalSubmitting) return;

  const value = modalInputFilename.value.trim();
  if (!value) {
    modalInputFilename.focus();
    return;
  }

  if (!currentModalCallback) {
    closeInputDialog();
    return;
  }

  isInputModalSubmitting = true;
  btnModalConfirm.disabled = true;
  btnModalCancel.disabled = true;

  try {
    const shouldClose = await currentModalCallback(value);
    if (shouldClose === false) {
      isInputModalSubmitting = false;
      btnModalConfirm.disabled = false;
      btnModalCancel.disabled = false;
      requestAnimationFrame(() => {
        modalInputFilename.focus();
        modalInputFilename.select();
      });
      return;
    }
    closeInputDialog();
  } catch (error) {
    alert(`Operation failed: ${error.message}`);
    isInputModalSubmitting = false;
    btnModalConfirm.disabled = false;
    btnModalCancel.disabled = false;
    requestAnimationFrame(() => {
      modalInputFilename.focus();
      modalInputFilename.select();
    });
  }
}

function showInputDialog(title, defaultValue, placeholder, confirmCallback) {
  document.querySelector('#input-modal h3').innerText = title;
  modalInputFilename.value = defaultValue;
  modalInputFilename.placeholder = placeholder;
  currentModalCallback = confirmCallback;
  isInputModalSubmitting = false;
  btnModalConfirm.disabled = false;
  btnModalCancel.disabled = false;

  inputModal.style.display = 'flex';
  requestAnimationFrame(() => {
    modalInputFilename.focus();
    modalInputFilename.select();
  });
}
