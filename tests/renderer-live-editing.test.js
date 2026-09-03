const assert = require('node:assert/strict');

const { createRendererHarness } = require('./renderer-harness');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createLiveBlock(text, parentNode = null) {
  return {
    nodeType: 1,
    parentNode,
    nodeName: 'P',
    textContent: text,
    outerHTML: `<p>${text}</p>`,
    cloneNode() {
      return {
        textContent: text,
        querySelectorAll: () => [],
        querySelector: () => null
      };
    },
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

// A fake MutationObserver whose records the test drives by hand, matching the
// contract renderer.js relies on: takeRecords() drains everything observed so far.
function createObserverFactory(state) {
  return function MutationObserverStub(callback) {
    return {
      callback,
      observe() {
        state.connected = true;
      },
      disconnect() {
        state.connected = false;
      },
      takeRecords() {
        const records = state.records.slice();
        state.records.length = 0;
        return records;
      }
    };
  };
}

test('merges a run of typed characters into a single undo step', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');

  textarea.value = 'a';
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  harness.context.recordEditorState('insertText', 'a');
  textarea.value = 'ab';
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  harness.context.recordEditorState('insertText', 'b');
  textarea.value = 'abc';
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  harness.context.recordEditorState('insertText', 'c');
  textarea.value = 'abcd';

  harness.context.undoEditorChange();

  assert.equal(textarea.value, 'a');
});

test('ends the undo group at a whitespace keystroke', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');

  textarea.value = 'ab';
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  harness.context.recordEditorState('insertText', 'b');
  textarea.value = 'ab ';
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  harness.context.recordEditorState('insertText', ' ');
  textarea.value = 'ab c';

  harness.context.undoEditorChange();

  assert.equal(textarea.value, 'ab ');
});

test('moving the caret elsewhere ends the typing run', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');

  textarea.value = 'ab';
  textarea.selectionStart = textarea.selectionEnd = 1;
  harness.context.recordEditorState('insertText', 'X');
  textarea.value = 'aXb';
  textarea.selectionStart = textarea.selectionEnd = 2;

  // The caret jumps to the end of the document (a click, an arrow key) and typing
  // continues inside the same coalescing window. The two edits are in unrelated
  // places, so one Ctrl+Z must not undo both.
  textarea.selectionStart = textarea.selectionEnd = 3;
  harness.context.recordEditorState('insertText', 'Y');
  textarea.value = 'aXbY';

  harness.context.undoEditorChange();
  assert.equal(textarea.value, 'aXb');

  harness.context.undoEditorChange();
  assert.equal(textarea.value, 'ab');
});

test('backspacing over a line break ends the deletion run', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');

  textarea.value = 'a\nb';
  textarea.selectionStart = textarea.selectionEnd = 3;
  harness.context.recordEditorState('deleteContentBackward', null);
  textarea.value = 'a\n';
  textarea.selectionStart = textarea.selectionEnd = 2;

  // Deleting the line break joins two lines. e.data is null for deletions, so the
  // whitespace rule has to read the character being removed from the document —
  // otherwise merging the lines lands in the same undo step as deleting 'b'.
  harness.context.recordEditorState('deleteContentBackward', null);
  textarea.value = 'a';
  textarea.selectionStart = textarea.selectionEnd = 1;

  harness.context.undoEditorChange();
  assert.equal(textarea.value, 'a\n');

  harness.context.undoEditorChange();
  assert.equal(textarea.value, 'a\nb');
});

test('never merges a toolbar action into the surrounding typing run', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');

  textarea.value = 'ab';
  harness.context.recordEditorState('insertText', 'b');
  textarea.value = 'abc';
  harness.context.recordEditorState();
  textarea.value = '**abc**';

  harness.context.undoEditorChange();

  assert.equal(textarea.value, 'abc');
});

test('a newer focus restore cancels the pending retries of the previous one', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');
  textarea.value = 'hello world';

  // Two undos in quick succession: the first restore's delayed retries must not
  // drag the caret back after the second one has already placed it.
  harness.context.focusActiveEditor(2);
  harness.context.focusActiveEditor(7);

  harness.flushAnimationFrames();
  harness.flushTimers();

  assert.equal(textarea.selectionStart, 7);
  assert.equal(textarea.selectionEnd, 7);
});

test('reconverts only the blocks a mutation touched', () => {
  const turndownCalls = [];
  const observerState = { connected: false, records: [] };
  const harness = createRendererHarness({
    contextOverrides: {
      MutationObserver: createObserverFactory(observerState),
      TurndownService: function TurndownService() {
        return {
          addRule() {},
          turndown(html) {
            turndownCalls.push(html);
            return html.replace(/<[^>]+>/g, '');
          }
        };
      }
    }
  });

  const preview = harness.elements.get('preview-content');
  harness.context.setViewMode('live');
  assert.equal(observerState.connected, true, 'live mode should observe the document');

  const first = createLiveBlock('one', preview);
  const second = createLiveBlock('two', preview);
  preview.childNodes = [first, second];
  preview.children = [first, second];

  harness.context.syncLiveContentToTextarea();
  assert.deepEqual(turndownCalls, ['<p>one</p>', '<p>two</p>']);

  // Nothing changed: the second pass must serve both blocks from the cache.
  turndownCalls.length = 0;
  harness.context.syncLiveContentToTextarea();
  assert.deepEqual(turndownCalls, []);

  // Only the second block changed, so only it is reconverted.
  second.textContent = 'two edited';
  second.outerHTML = '<p>two edited</p>';
  observerState.records.push({ target: second, addedNodes: [] });

  turndownCalls.length = 0;
  harness.context.syncLiveContentToTextarea();
  assert.deepEqual(turndownCalls, ['<p>two edited</p>']);
  assert.equal(harness.elements.get('markdown-textarea').value, 'one\n\ntwo edited');
});

test('reconverts every block when no MutationObserver is available', () => {
  const turndownCalls = [];
  const harness = createRendererHarness({
    contextOverrides: {
      MutationObserver: undefined,
      TurndownService: function TurndownService() {
        return {
          addRule() {},
          turndown(html) {
            turndownCalls.push(html);
            return html.replace(/<[^>]+>/g, '');
          }
        };
      }
    }
  });

  const preview = harness.elements.get('preview-content');
  harness.context.setViewMode('live');

  const block = createLiveBlock('one', preview);
  preview.childNodes = [block];
  preview.children = [block];

  harness.context.syncLiveContentToTextarea();
  harness.context.syncLiveContentToTextarea();

  // Without change tracking, cached Markdown could be stale, so caching stays off.
  assert.deepEqual(turndownCalls, ['<p>one</p>', '<p>one</p>']);
});

test('defers word counts and outline rebuilds until typing pauses', () => {
  const observerState = { connected: false, records: [] };
  const harness = createRendererHarness({
    contextOverrides: {
      MutationObserver: createObserverFactory(observerState),
      TurndownService: function TurndownService() {
        return { addRule() {}, turndown: (html) => html.replace(/<[^>]+>/g, '') };
      }
    }
  });

  const preview = harness.elements.get('preview-content');
  const charCount = harness.elements.get('char-count');
  harness.context.setViewMode('live');

  const block = createLiveBlock('hello', preview);
  preview.childNodes = [block];
  preview.children = [block];

  charCount.innerText = '';
  harness.context.syncLiveContentToTextarea();
  assert.equal(charCount.innerText, '', 'stats must not be recomputed on every keystroke');

  harness.flushTimers();
  assert.equal(charCount.innerText, '5 chars');
});

function attachBlocks(preview, blocks) {
  blocks.forEach((block) => { block.parentNode = preview; });
  preview.childNodes = blocks;
  preview.children = blocks;
  preview.contains = (node) => node === preview || blocks.includes(node);
}

function placeCaretIn(harness, node) {
  const selection = harness.context.window.getSelection();
  selection.rangeCount = 1;
  selection.anchorNode = node;
}

function createLiveHarness() {
  const observerState = { connected: false, records: [] };
  const harness = createRendererHarness({
    contextOverrides: {
      MutationObserver: createObserverFactory(observerState),
      TurndownService: function TurndownService() {
        return { addRule() {}, turndown: (html) => html.replace(/<[^>]+>/g, '') };
      }
    }
  });
  harness.observerState = observerState;
  return harness;
}

test('re-renders the block the user actually edited after earlier blocks shift', () => {
  const harness = createLiveHarness();
  const preview = harness.elements.get('preview-content');
  harness.context.setViewMode('live');
  // Drain the focus restore setViewMode queues; it moves the caret itself.
  harness.flushAnimationFrames();
  harness.flushTimers();

  const first = createLiveBlock('one');
  const edited = createLiveBlock('two');
  attachBlocks(preview, [first, edited]);

  // The user types in the second block.
  placeCaretIn(harness, edited);
  harness.context.handleLiveMouseUp({ button: 0 });
  harness.flushAnimationFrames();
  harness.context.handleLiveEditInput();

  // A paragraph is inserted ahead of it, so every later index shifts by one.
  const inserted = createLiveBlock('new');
  attachBlocks(preview, [inserted, first, edited]);

  const reRendered = [];
  harness.context.reRenderSingleBlock = (block) => reRendered.push(block.textContent);

  placeCaretIn(harness, first);
  harness.context.handleLiveMouseUp({ button: 0 });
  harness.flushAnimationFrames();

  assert.deepEqual(reRendered, ['two']);
});

function pasteInto(harness, text) {
  const inserted = [];
  harness.context.document.execCommand = (command, showUi, value) => {
    inserted.push([command, value]);
    return true;
  };

  let defaultPrevented = false;
  harness.context.handleLivePaste({
    clipboardData: {
      getData: (type) => (type === 'text/plain' ? text : '<b>rich</b>')
    },
    preventDefault() { defaultPrevented = true; }
  });

  return { inserted, defaultPrevented };
}

test('never lets clipboard HTML into the live editor', () => {
  const harness = createLiveHarness();
  harness.context.setViewMode('live');

  const { inserted, defaultPrevented } = pasteInto(harness, 'plain text');

  assert.equal(defaultPrevented, true, 'the browser must not insert clipboard HTML');
  assert.deepEqual(inserted, [['insertText', 'plain text']]);
});

test('parses a multi-line paste as Markdown instead of one block per line', () => {
  const harness = createRendererHarness({
    contextOverrides: {
      MutationObserver: createObserverFactory({ connected: false, records: [] }),
      TurndownService: function TurndownService() {
        return { addRule() {}, turndown: (html) => html.replace(/<[^>]+>/g, '') };
      },
      marked: require('marked').marked,
      DOMPurify: { sanitize: (html) => html }
    }
  });
  harness.context.setViewMode('live');

  const { inserted } = pasteInto(harness, '# Title\n\nA paragraph.\n\n- one\n- two\n');

  assert.equal(inserted.length, 1);
  const [command, html] = inserted[0];
  // insertText would turn every newline into its own block, and every blank line
  // into a permanent empty-paragraph placeholder.
  assert.equal(command, 'insertHTML');
  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<ul>/);
  assert.doesNotMatch(html, /<p><br><\/p>/, 'blank lines must separate paragraphs, not become placeholders');
});

test('takes the heading list to the same edge as the document', () => {
  const harness = createLiveHarness();
  const container = harness.elements.get('preview-container');
  const nav = harness.elements.get('live-heading-nav');
  container.scrollTo = ({ top }) => { container.scrollTop = top; };
  container.scrollHeight = 5000;
  nav.scrollHeight = 900;
  nav.scrollTop = 400;
  harness.context.setViewMode('live');

  harness.context.scrollLiveDocumentToEdge('bottom');
  assert.equal(container.scrollTop, 5000);
  assert.equal(nav.scrollTop, 900);

  harness.context.scrollLiveDocumentToEdge('top');
  assert.equal(container.scrollTop, 0);
  assert.equal(nav.scrollTop, 0);
});

test('collapses a burst of scroll events into one viewport update', () => {
  const harness = createLiveHarness();
  harness.context.setViewMode('live');

  let scheduled = 0;
  harness.context.requestAnimationFrame = (callback) => {
    scheduled += 1;
    return callback;
  };

  harness.context.scheduleLiveViewportUpdate();
  harness.context.scheduleLiveViewportUpdate();
  harness.context.scheduleLiveViewportUpdate();

  assert.equal(scheduled, 1);
});

test('skips rebuilding the heading nav when the headings are unchanged', () => {
  const harness = createLiveHarness();
  const nav = harness.elements.get('live-heading-nav');
  harness.context.setViewMode('live');

  let rebuilds = 0;
  nav.replaceChildren = () => { rebuilds += 1; };

  const headers = [{ level: 1, text: 'Title', lineIndex: 0 }];
  harness.context.renderLiveHeadingNav(headers);
  harness.context.renderLiveHeadingNav([{ level: 1, text: 'Title', lineIndex: 0 }]);
  assert.equal(rebuilds, 1);

  harness.context.renderLiveHeadingNav([{ level: 2, text: 'Title', lineIndex: 0 }]);
  assert.equal(rebuilds, 2);
});
