const assert = require('node:assert/strict');

const { createEditorHistory } = require('../editor-history');

function makeState(content, selectionStart = content.length, selectionEnd = selectionStart) {
  return {
    content,
    selectionStart,
    selectionEnd,
    liveSelection: null,
    liveScrollTop: 0,
    textareaScrollTop: 0
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('keeps undo history within entry and character budgets', () => {
  const history = createEditorHistory({ maxEntries: 3, maxChars: 10, maxStateChars: 20 });

  history.pushUndo(makeState('aaaa'));
  history.pushUndo(makeState('bbbb'));
  history.pushUndo(makeState('cccc'));
  history.pushUndo(makeState('dddd'));

  assert.equal(history.undoLength, 2);
  assert.equal(history.undoCharCount, 8);
  assert.equal(history.popUndo().content, 'dddd');
  assert.equal(history.popUndo().content, 'cccc');
});

test('skips oversized snapshots to protect renderer memory', () => {
  const history = createEditorHistory({ maxEntries: 10, maxChars: 100, maxStateChars: 8 });

  history.pushUndo(makeState('small'));
  history.pushUndo(makeState('this snapshot is too large'));

  assert.equal(history.undoLength, 1);
  assert.equal(history.undoCharCount, 5);
  assert.equal(history.popUndo().content, 'small');
});

test('clears redo history when a new undo snapshot is recorded', () => {
  const history = createEditorHistory({ maxEntries: 10, maxChars: 100, maxStateChars: 100 });

  history.pushUndo(makeState('one'));
  history.pushRedo(makeState('redo'));
  history.pushUndo(makeState('two'));

  assert.equal(history.undoLength, 2);
  assert.equal(history.redoLength, 0);
});

test('can preserve redo history while moving the current state during redo', () => {
  const history = createEditorHistory({ maxEntries: 10, maxChars: 100, maxStateChars: 100 });

  history.pushRedo(makeState('redo one'));
  history.pushRedo(makeState('redo two'));
  history.pushUndo(makeState('current'), { preserveRedo: true });

  assert.equal(history.undoLength, 1);
  assert.equal(history.redoLength, 2);
  assert.equal(history.popRedo().content, 'redo two');
});
