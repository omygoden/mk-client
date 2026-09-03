const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createEditorHistory } = require('../editor-history');

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
    removeEventListener() {},
    replaceChildren(...nodes) {
      this.children = nodes;
    },
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

function createRendererHarness(options = {}) {
  const { contextOverrides = {}, windowOverrides = {} } = options;
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
    createElement(tagName) {
      const element = createElement(`created-${tagName}`, documentRef);
      element.tagName = tagName.toUpperCase();
      element.dataset = {};
      return element;
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
    isCollapsed: true,
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
      const handle = { callback, delay, cancelled: false };
      timeoutQueue.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      if (handle && typeof handle === 'object') handle.cancelled = true;
    },
    alert() {},
    confirm: () => true,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4 },
    lucide: { createIcons() {} },
    marked: { parse: () => '', setOptions() {} },
    DOMPurify: { sanitize: (html) => html },
    TurndownService: function TurndownService() {
      return { addRule() {}, turndown: () => '' };
    }
  };
  Object.assign(context.window, windowOverrides);
  Object.assign(context, contextOverrides);
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
        const pending = timeoutQueue.shift();
        if (!pending.cancelled) pending.callback();
      }
    }
  };
}

module.exports = { createRendererHarness, createClassList, createElement };
