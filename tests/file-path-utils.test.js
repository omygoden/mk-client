const assert = require('node:assert/strict');
const path = require('node:path');
const { getSafeChildPath } = require('../file-path-utils');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('creates a direct child path for a safe filename', () => {
  assert.equal(getSafeChildPath('/workspace/notes', 'meeting.txt'), path.join('/workspace/notes', 'meeting.txt'));
});

test('rejects path traversal and separator characters in file operation names', () => {
  assert.equal(getSafeChildPath('/workspace/notes', '../outside.txt'), null);
  assert.equal(getSafeChildPath('/workspace/notes', 'nested/note.md'), null);
  assert.equal(getSafeChildPath('/workspace/notes', 'nested\\note.md'), null);
});
