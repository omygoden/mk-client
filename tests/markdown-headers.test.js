const assert = require('node:assert/strict');

const { marked } = require('marked');
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

function headersFor(markdown) {
  const harness = createRendererHarness();
  harness.elements.get('markdown-textarea').value = markdown;
  // The renderer runs in a vm context, so its arrays/objects have foreign
  // prototypes; round-trip through JSON to compare against plain host values.
  return JSON.parse(JSON.stringify(harness.context.getMarkdownHeaders()));
}

test('ignores hash lines inside a fenced code block', () => {
  const headers = headersFor([
    '# Real Title',
    '',
    '```bash',
    '# install deps',
    'npm install',
    '```',
    '',
    '## Second'
  ].join('\n'));

  assert.deepEqual(headers.map((h) => h.text), ['Real Title', 'Second']);
  assert.deepEqual(headers.map((h) => h.lineIndex), [0, 7]);
});

test('ignores hash lines inside a tilde fence and closes on the matching marker', () => {
  const headers = headersFor([
    '~~~',
    '# not a heading',
    '```',
    '~~~',
    '# heading'
  ].join('\n'));

  assert.deepEqual(headers.map((h) => h.text), ['heading']);
});

test('recognises Setext headings so the outline matches the rendered document', () => {
  const headers = headersFor([
    'Chapter One',
    '===========',
    '',
    'Chapter Two',
    '-----------'
  ].join('\n'));

  assert.deepEqual(headers, [
    { level: 1, text: 'Chapter One', lineIndex: 0 },
    { level: 2, text: 'Chapter Two', lineIndex: 3 }
  ]);
});

// The live outline maps its Nth entry onto the Nth rendered <h*>, so the invariant
// that actually matters is agreement with marked — not any hand-held expectation.
function renderedHeadingLevels(markdown) {
  marked.setOptions({ breaks: true, gfm: true, headerIds: true, mangle: false });
  return Array.from(marked.parse(markdown).matchAll(/<h([1-6])[^>]*>/g)).map((m) => Number(m[1]));
}

function assertMatchesRenderedHeadings(markdown, label) {
  assert.deepEqual(
    headersFor(markdown).map((header) => header.level),
    renderedHeadingLevels(markdown),
    label
  );
}

test('agrees with the renderer on a document mixing fences, rules, tables and lists', () => {
  assertMatchesRenderedHeadings([
    '---',
    'title: Front Matter',
    '---',
    '',
    '# Title',
    '',
    '```bash',
    '# not a heading',
    '```',
    '',
    'Setext Chapter',
    '--------------',
    '',
    'A paragraph.',
    '',
    '---',
    '',
    '| a | b |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '- list item',
    '---',
    '',
    '### Deep'
  ].join('\n'), 'heading levels must line up one for one');
});

test('agrees with the renderer when a thematic break follows a blank line', () => {
  assertMatchesRenderedHeadings('Intro text\n\n---\n\n## After', 'a rule after a blank line is not a heading');
});

test('strips closing hashes from an ATX heading', () => {
  const headers = headersFor('### Middle ###');
  assert.deepEqual(headers, [{ level: 3, text: 'Middle', lineIndex: 0 }]);
});

test('agrees with the renderer on headings that are still being typed', () => {
  ['#', '###', '### ', '# Title', '#Not a heading', '####### seven'].forEach((line) => {
    assertMatchesRenderedHeadings(line, `mismatch for ${JSON.stringify(line)}`);
  });
});
