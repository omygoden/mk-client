const assert = require('node:assert/strict');
const vm = require('node:vm');

const TurndownService = require('turndown');
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

// The live editor keeps the document as HTML and rewrites the Markdown source on
// every edit, so anything Turndown cannot express survives only until the next
// render — saving and reopening silently changes the document.
function createTurndownHarness() {
  const harness = createRendererHarness({ contextOverrides: { TurndownService, marked } });
  harness.context.configureMarkdownRenderer();
  harness.context.initTurndown();
  return (html) => vm.runInContext('turndownService.turndown(HTML_UNDER_TEST)', Object.assign(harness.context, { HTML_UNDER_TEST: html }));
}

test('a line break inside a heading survives the save/reopen round trip', () => {
  const toMarkdown = createTurndownHarness();

  const markdown = toMarkdown('<h1>标题<br>续行</h1>');
  const reRendered = marked.parse(markdown).trim();

  // Rendering the saved Markdown again must give back the same heading. Serialising
  // the break as a bare newline splits the heading into a heading plus a paragraph,
  // which is the deleted line break reappearing.
  assert.equal(reRendered, '<h1>标题<br>续行</h1>');
});

test('an otherwise empty heading keeps its line break instead of losing it', () => {
  const toMarkdown = createTurndownHarness();

  const markdown = toMarkdown('<h1><br></h1>');

  assert.equal(marked.parse(markdown).trim(), '<h1><br></h1>');
});

test('a line break inside a paragraph still serialises as a bare newline', () => {
  const toMarkdown = createTurndownHarness();

  const markdown = toMarkdown('<p>第一行<br>第二行</p>');

  assert.equal(markdown, '第一行\n第二行');
  assert.equal(marked.parse(markdown).trim(), '<p>第一行<br>第二行</p>');
});

test('drops the placeholder break Chromium parks at the end of a heading', () => {
  const toMarkdown = createTurndownHarness();

  // Chromium keeps a trailing <br> in a block so the last line stays visible. It
  // is not part of the document and must not be written into the file.
  assert.equal(toMarkdown('<h1>标题<br></h1>'), '# 标题');
  assert.equal(toMarkdown('<h1>标题<br><br></h1>'), '# 标题');
});
