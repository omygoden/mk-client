(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EditorHistory = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getStateCharCount(state) {
    return state && typeof state.content === 'string' ? state.content.length : 0;
  }

  function createEditorHistory(options = {}) {
    const maxEntries = Math.max(1, options.maxEntries || 200);
    const maxChars = Math.max(1, options.maxChars || 8_000_000);
    const maxStateChars = Math.max(1, options.maxStateChars || 4_000_000);
    const undoStack = [];
    const redoStack = [];
    let undoCharCount = 0;
    let redoCharCount = 0;

    function trimStack(stack, getCharCount, setCharCount) {
      let charCount = getCharCount();
      while (stack.length > maxEntries) {
        charCount -= getStateCharCount(stack.shift());
      }
      while (charCount > maxChars && stack.length > 1) {
        charCount -= getStateCharCount(stack.shift());
      }
      setCharCount(Math.max(0, charCount));
    }

    function pushStack(stack, state, getCharCount, setCharCount) {
      const stateChars = getStateCharCount(state);
      if (stateChars > maxStateChars) return false;

      stack.push(state);
      setCharCount(getCharCount() + stateChars);
      trimStack(stack, getCharCount, setCharCount);
      return true;
    }

    function clearRedo() {
      redoStack.length = 0;
      redoCharCount = 0;
    }

    return {
      get undoLength() {
        return undoStack.length;
      },
      get redoLength() {
        return redoStack.length;
      },
      get undoCharCount() {
        return undoCharCount;
      },
      get redoCharCount() {
        return redoCharCount;
      },
      peekUndo() {
        return undoStack[undoStack.length - 1] || null;
      },
      pushUndo(state, options = {}) {
        const pushed = pushStack(undoStack, state, () => undoCharCount, (value) => {
          undoCharCount = value;
        });
        if (!options.preserveRedo) clearRedo();
        return pushed;
      },
      pushRedo(state) {
        return pushStack(redoStack, state, () => redoCharCount, (value) => {
          redoCharCount = value;
        });
      },
      popUndo() {
        const state = undoStack.pop() || null;
        undoCharCount = Math.max(0, undoCharCount - getStateCharCount(state));
        return state;
      },
      popRedo() {
        const state = redoStack.pop() || null;
        redoCharCount = Math.max(0, redoCharCount - getStateCharCount(state));
        return state;
      },
      reset() {
        undoStack.length = 0;
        redoStack.length = 0;
        undoCharCount = 0;
        redoCharCount = 0;
      }
    };
  }

  return { createEditorHistory };
});
