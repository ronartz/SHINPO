import test from 'node:test'
import assert from 'node:assert/strict'
import { tokenizeInlineMarkdown, parseMarkdownBlocks } from '../../utils/markdownUtils.ts'

test('tokenizeInlineMarkdown parses bold, italic, and code tokens safely', () => {
  const tokens = tokenizeInlineMarkdown('Hello **bold** and *italic* and `code`')
  assert.equal(tokens.length, 6)
  assert.deepEqual(tokens[0], { type: 'text', text: 'Hello ' })
  assert.deepEqual(tokens[1], { type: 'bold', text: 'bold' })
  assert.deepEqual(tokens[2], { type: 'text', text: ' and ' })
  assert.deepEqual(tokens[3], { type: 'italic', text: 'italic' })
  assert.deepEqual(tokens[4], { type: 'text', text: ' and ' })
  assert.deepEqual(tokens[5], { type: 'code', code: 'code' })
})

test('tokenizeInlineMarkdown protects against javascript: links', () => {
  const safeTokens = tokenizeInlineMarkdown('[Docs](https://example.com/docs)')
  assert.equal(safeTokens.length, 1)
  assert.deepEqual(safeTokens[0], {
    type: 'link',
    label: 'Docs',
    url: 'https://example.com/docs',
    isSafe: true,
  })

  // Malicious javascript link is flagged as unsafe
  const unsafeTokens = tokenizeInlineMarkdown('[Attack](javascript:alert(1))')
  assert.equal(unsafeTokens.length, 1)
  assert.deepEqual(unsafeTokens[0], {
    type: 'link',
    label: 'Attack',
    url: 'javascript:alert(1)',
    isSafe: false,
  })
})

test('parseMarkdownBlocks generates structured blocks for headings, code blocks, lists and paragraphs', () => {
  const content = `# Tactical Briefing\n\nHere is **focus advice**:\n- Item 1\n- Item 2\n\n\`\`\`ts\nconst x = 42\n\`\`\``
  const blocks = parseMarkdownBlocks(content)
  assert.equal(blocks.length, 4)

  // Heading h1 -> level 1
  assert.equal(blocks[0].type, 'heading')
  if (blocks[0].type === 'heading') {
    assert.equal(blocks[0].level, 1)
    assert.equal(blocks[0].text, 'Tactical Briefing')
  }

  // Paragraph
  assert.equal(blocks[1].type, 'paragraph')
  if (blocks[1].type === 'paragraph') {
    assert.equal(blocks[1].text, 'Here is **focus advice**:')
  }

  // Unordered list
  assert.equal(blocks[2].type, 'ul')
  if (blocks[2].type === 'ul') {
    assert.deepEqual(blocks[2].items, ['Item 1', 'Item 2'])
  }

  // Code block
  assert.equal(blocks[3].type, 'codeblock')
  if (blocks[3].type === 'codeblock') {
    assert.equal(blocks[3].language, 'ts')
    assert.equal(blocks[3].code, 'const x = 42')
  }
})
