export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; code: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'bold_italic'; text: string }
  | { type: 'link'; label: string; url: string; isSafe: boolean }

/**
 * Safely parse inline markdown tokens:
 * - Bold + Italic (***text*** or ___text___)
 * - Bold (**text** or __text__)
 * - Italic (*text* or _text_)
 * - Inline code (`code`)
 * - Links ([label](url)) - http(s) only
 */
export function tokenizeInlineMarkdown(text: string): InlineToken[] {
  if (!text) return []

  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|(?<!\w)\*[^*]+?\*(?!\w)|(?<!\w)_[^_]+?_(?!\w)|\[[^\]]+\]\(((?:[^()]+|\([^()]*\))*)\))/g

  const tokens: InlineToken[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }

    const token = match[0]

    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      tokens.push({ type: 'code', code: token.slice(1, -1) })
    } else if (
      (token.startsWith('***') && token.endsWith('***') && token.length >= 6) ||
      (token.startsWith('___') && token.endsWith('___') && token.length >= 6)
    ) {
      tokens.push({ type: 'bold_italic', text: token.slice(3, -3) })
    } else if (
      (token.startsWith('**') && token.endsWith('**') && token.length >= 4) ||
      (token.startsWith('__') && token.endsWith('__') && token.length >= 4)
    ) {
      tokens.push({ type: 'bold', text: token.slice(2, -2) })
    } else if (
      (token.startsWith('*') && token.endsWith('*') && token.length >= 2) ||
      (token.startsWith('_') && token.endsWith('_') && token.length >= 2)
    ) {
      tokens.push({ type: 'italic', text: token.slice(1, -1) })
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const closeBracket = token.indexOf('](')
      const label = token.slice(1, closeBracket)
      const url = token.slice(closeBracket + 2, -1).trim()
      const isSafe = /^https?:\/\//i.test(url)
      tokens.push({ type: 'link', label, url, isSafe })
    } else {
      tokens.push({ type: 'text', text: token })
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return tokens
}

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string }

/**
 * Tokenize markdown text into structural blocks.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return []

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++ // consume closing ```
      }
      blocks.push({
        type: 'codeblock',
        language,
        code: codeLines.join('\n'),
      })
      continue
    }

    // 2. Horizontal Rule: ---, ***, ___
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 3. Headings: #, ##, ###, ####
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 4)
      blocks.push({
        type: 'heading',
        level,
        text: headingMatch[2].trim(),
      })
      i++
      continue
    }

    // 4. Blockquote: > text
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n'),
      })
      continue
    }

    // 5. Unordered List: - item, * item, • item
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, '').trim())
        i++
      }
      blocks.push({
        type: 'ul',
        items,
      })
      continue
    }

    // 6. Ordered List: 1. item
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim())
        i++
      }
      blocks.push({
        type: 'ol',
        items,
      })
      continue
    }

    // 7. Empty line - ignore
    if (line.trim() === '') {
      i++
      continue
    }

    // 8. Paragraph: Accumulate consecutive non-empty, non-block lines
    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(---|___|\*\*\*)$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i])
      i++
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paragraphLines.join('\n'),
      })
    }
  }

  return blocks
}
