const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createEditorHistory } = require('../editor-history');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createClassList() {
  const names = new Set();
  return {
    add: (...items) => items.forEach((item) => names.add(item)),
    remove: (...items) => items.forEach((item) => names.delete(item)),
    contains: (item) => names.has(item),
    toggle: (item, force) => {
      const shouldAdd = force === undefined ? !names.has(item) : Boolean(force);
      if (shouldAdd) {
        names.add(item);
      } else {
        names.delete(item);
      }
      return shouldAdd;
    }
  };
}

function createElement(id, documentRef) {
  return {
    id,
    value: '',
    placeholder: '',
    innerText: '',
    textContent: '',
    style: { display: 'none' },
    classList: createClassList(),
    childNodes: [],
    children: [],
    selectionStart: 0,
    selectionEnd: 0,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    nodeType: 1,
    firstElementChild: null,
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    contains(node) {
      return node === this;
    },
    focus() {
      documentRef.activeElement = this;
    },
    select() {
      this.selectionStart = 0;
      this.selectionEnd = this.value.length;
    },
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createRendererHarness() {
  const elements = new Map();
  const rafQueue = [];
  const timeoutQueue = [];

  const documentRef = {
    activeElement: null,
    body: null,
    addEventListener() {},
    querySelector(selector) {
      if (selector === '#input-modal h3') return this.getElementById('input-modal-title');
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createRange() {
      return {
        setStart() {},
        setEnd() {},
        collapse() {},
        selectNodeContents() {},
        cloneRange() { return this; },
        toString() { return ''; },
        getBoundingClientRect() { return { width: 0, height: 0 }; }
      };
    },
    createTreeWalker() {
      return {
        nextNode() {
          return null;
        }
      };
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createElement(id, documentRef));
      }
      return elements.get(id);
    }
  };
  documentRef.body = documentRef.getElementById('body');

  const selection = {
    rangeCount: 0,
    anchorNode: null,
    removeAllRanges() {
      this.rangeCount = 0;
      this.anchorNode = null;
    },
    addRange() {
      this.rangeCount = 1;
    },
    getRangeAt() {
      return documentRef.createRange();
    }
  };

  const context = {
    console,
    window: {
      EditorHistory: { createEditorHistory },
      addEventListener() {},
      getSelection: () => selection,
      requestIdleCallback: (callback) => callback(),
      electronAPI: { setZoomFactor() {} }
    },
    document: documentRef,
    navigator: { userAgent: 'Mac' },
    localStorage: {
      getItem() { return null; },
      setItem() {}
    },
    requestAnimationFrame(callback) {
      rafQueue.push(callback);
    },
    setTimeout(callback, delay) {
      timeoutQueue.push({ callback, delay });
      return timeoutQueue.length;
    },
    clearTimeout() {},
    alert() {},
    confirm: () => true,
    Node: { TEXT_NODE: 3 },
    NodeFilter: { SHOW_TEXT: 4 },
    lucide: { createIcons() {} },
    marked: { parse: () => '' },
    DOMPurify: { sanitize: (html) => html },
    TurndownService: function TurndownService() {
      return { addRule() {}, turndown: () => '' };
    }
  };
  context.globalThis = context;

  vm.createContext(context);
  const rendererPath = path.join(__dirname, '..', 'renderer.js');
  vm.runInContext(fs.readFileSync(rendererPath, 'utf8'), context, { filename: rendererPath });
  context.initDOMReferences();

  return {
    context,
    elements,
    document: documentRef,
    flushAnimationFrames() {
      while (rafQueue.length > 0) {
        rafQueue.shift()();
      }
    },
    flushTimers() {
      timeoutQueue.sort((a, b) => a.delay - b.delay);
      while (timeoutQueue.length > 0) {
        timeoutQueue.shift().callback();
      }
    }
  };
}

test('keeps the create-file filename input focused after pending editor focus retries run', () => {
  const harness = createRendererHarness();
  const input = harness.elements.get('modal-input-filename');
  const preview = harness.elements.get('preview-content');

  harness.context.focusActiveEditor(0);
  harness.context.showInputDialog('Create New File', 'Untitled', 'Enter filename', () => true);

  harness.flushAnimationFrames();
  assert.equal(harness.document.activeElement, input);

  harness.flushTimers();
  assert.equal(harness.document.activeElement, input);
  assert.notEqual(harness.document.activeElement, preview);
});

test('keeps a file context menu fully within the bottom-right viewport edge', () => {
  const harness = createRendererHarness();
  const menu = harness.elements.get('context-menu');
  menu.getBoundingClientRect = () => ({ width: 180, height: 240 });
  harness.context.window.innerWidth = 800;
  harness.context.window.innerHeight = 600;

  harness.context.positionContextMenu(menu, 780, 580);

  assert.equal(menu.style.left, '612px');
  assert.equal(menu.style.top, '352px');
});

test('uses the requested default extension without changing an explicit text or Markdown extension', () => {
  const harness = createRendererHarness();

  assert.equal(harness.context.getNewFileName('notes', '.txt'), 'notes.txt');
  assert.equal(harness.context.getNewFileName('notes', '.md'), 'notes.md');
  assert.equal(harness.context.getNewFileName('notes.txt', '.md'), 'notes.txt');
  assert.equal(harness.context.getNewFileName('notes.markdown', '.txt'), 'notes.markdown');
});

test('updates visibility for both file-creation context-menu actions', () => {
  const harness = createRendererHarness();

  assert.doesNotThrow(() => harness.context.updateFileContextMenuState(false));
  assert.equal(harness.elements.get('ctx-create-text-file').style.display, 'flex');
  assert.equal(harness.elements.get('ctx-create-markdown-file').style.display, 'flex');
});
