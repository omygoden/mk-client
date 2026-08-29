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

test('flips a file context menu above the cursor near the bottom-right viewport edge', () => {
  const harness = createRendererHarness();
  const menu = harness.elements.get('context-menu');
  menu.getBoundingClientRect = () => ({ width: 180, height: 240 });
  harness.context.window.innerWidth = 800;
  harness.context.window.innerHeight = 600;

  harness.context.positionContextMenu(menu, 780, 580);

  assert.equal(menu.style.left, '612px');
  assert.equal(menu.style.top, '340px');
});

test('caps a context menu taller than the viewport and keeps it scrollable in place', () => {
  const harness = createRendererHarness();
  const menu = harness.elements.get('context-menu');
  menu.getBoundingClientRect = () => ({ width: 180, height: 900 });
  harness.context.window.innerWidth = 800;
  harness.context.window.innerHeight = 600;

  harness.context.positionContextMenu(menu, 400, 580);

  assert.equal(menu.style.maxHeight, '584px');
  assert.equal(menu.style.top, '8px');
});

test('repositions a context menu after its rendered height changes', () => {
  const harness = createRendererHarness();
  const menu = harness.elements.get('context-menu');
  let renderedHeight = 120;
  menu.getBoundingClientRect = () => ({ width: 180, height: renderedHeight });
  harness.context.window.innerWidth = 800;
  harness.context.window.innerHeight = 600;

  harness.context.showContextMenuAt(menu, 400, 580);
  renderedHeight = 240;
  harness.flushAnimationFrames();

  assert.equal(menu.style.top, '340px');
});

test('leaves the hidden textarea untouched when a live-mode formatting shortcut has no rendered caret', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  textarea.value = 'hello';
  harness.context.setViewMode('live');

  harness.context.applyFormattingShortcut('**', '**');

  assert.equal(textarea.value, 'hello');
});

test('applies a formatting shortcut even when caps lock uppercases the key', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  harness.context.setViewMode('edit');
  textarea.value = 'hello';
  textarea.selectionStart = 0;
  textarea.selectionEnd = 5;

  harness.context.handleGlobalShortcuts({
    key: 'B',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    target: textarea,
    preventDefault() {}
  });

  assert.equal(textarea.value, '**hello**');
});

test('ignores formatting shortcuts pressed inside a plain text input', () => {
  const harness = createRendererHarness();
  const textarea = harness.elements.get('markdown-textarea');
  const input = harness.elements.get('modal-input-filename');
  input.tagName = 'INPUT';
  harness.context.setViewMode('edit');
  textarea.value = 'hello';

  harness.context.handleGlobalShortcuts({
    key: 'b',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    target: input,
    preventDefault() {}
  });

  assert.equal(textarea.value, 'hello');
});

test('keeps the live DOM intact when focus moves into the editor context menu', () => {
  const harness = createRendererHarness();
  const preview = harness.elements.get('preview-content');
  const menu = harness.elements.get('editor-context-menu');
  harness.context.setViewMode('live');
  preview.innerHTML = '<p>hello</p>';

  harness.context.handleLiveEditBlur({ relatedTarget: menu });

  assert.equal(preview.innerHTML, '<p>hello</p>');
});

test('does not schedule a live block re-render for a right-click mouseup', () => {
  const harness = createRendererHarness();
  harness.context.setViewMode('live');

  let scheduled = 0;
  harness.context.requestAnimationFrame = () => { scheduled += 1; };

  harness.context.handleLiveMouseUp({ button: 2 });
  assert.equal(scheduled, 0);

  harness.context.handleLiveMouseUp({ button: 0 });
  assert.equal(scheduled, 1);
});

test('does not steal focus back from the find bar after a pending editor focus retry', () => {
  const harness = createRendererHarness();
  const findBar = harness.elements.get('find-bar');
  const findInput = harness.elements.get('find-input');
  const preview = harness.elements.get('preview-content');
  findBar.style.display = 'block';
  findInput.focus();

  harness.context.focusActiveEditor(0);
  harness.flushAnimationFrames();
  harness.flushTimers();

  assert.equal(harness.document.activeElement, findInput);
  assert.notEqual(harness.document.activeElement, preview);
});

test('hides the replace controls in read-only preview mode and restores them elsewhere', () => {
  const harness = createRendererHarness();
  const group = harness.elements.get('find-replace-group');
  const replaceAllButton = harness.elements.get('find-replace-all');

  harness.context.setViewMode('preview');
  assert.equal(group.style.display, 'none');
  assert.equal(replaceAllButton.style.display, 'none');

  harness.context.setViewMode('edit');
  assert.equal(group.style.display, '');
  assert.equal(replaceAllButton.style.display, '');
});

test('uses the requested default extension without changing an explicit text or Markdown extension', () => {
  const harness = createRendererHarness();

  assert.equal(harness.context.getNewFileName('notes', '.txt'), 'notes.txt');
  assert.equal(harness.context.getNewFileName('notes', '.md'), 'notes.md');
  assert.equal(harness.context.getNewFileName('notes.txt', '.md'), 'notes.txt');
  assert.equal(harness.context.getNewFileName('notes.markdown', '.txt'), 'notes.markdown');
});

test('updates visibility for the file-creation context-menu action', () => {
  const harness = createRendererHarness();

  assert.doesNotThrow(() => harness.context.updateFileContextMenuState(false));
  assert.equal(harness.elements.get('ctx-create-markdown-file').style.display, 'flex');
});

test('appends the Markdown extension to a bare filename but keeps an explicit one', () => {
  const harness = createRendererHarness();

  assert.equal(harness.context.getNewFileName('报告', '.md'), '报告.md');
  assert.equal(harness.context.getNewFileName('  notes  ', '.md'), 'notes.md');
  assert.equal(harness.context.getNewFileName('readme.md', '.md'), 'readme.md');
  assert.equal(harness.context.getNewFileName('changelog.txt', '.md'), 'changelog.txt');
});
