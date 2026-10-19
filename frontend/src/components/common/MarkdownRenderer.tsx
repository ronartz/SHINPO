import React from 'react'
import {
  tokenizeInlineMarkdown,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from '../../utils/markdownUtils'

export interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Safely parse inline markdown tokens and render them as ReactNodes.
 * Returns an array of ReactNodes (100% safe, no dangerouslySetInnerHTML)
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return []
  const tokens = tokenizeInlineMarkdown(text)

  return tokens.map((token, index) => {
    switch (token.type) {
      case 'code':
        return (
          <code key={`code-${index}`} className="md-inline-code">
            {token.code}
          </code>
        )
      case 'bold_italic':
        return (
          <strong key={`bi-${index}`} className="md-strong-em">
            <em>{renderInlineMarkdown(token.text)}</em>
          </strong>
        )
      case 'bold':
        return (
          <strong key={`b-${index}`} className="md-strong">
            {renderInlineMarkdown(token.text)}
          </strong>
        )
      case 'italic':
        return (
          <em key={`i-${index}`} className="md-em">
            {renderInlineMarkdown(token.text)}
          </em>
        )
      case 'link':
        if (token.isSafe) {
          return (
            <a
              key={`a-${index}`}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="md-link"
            >
              {token.label}
            </a>
          )
        }
        return `[${token.label}](${token.url})`
      case 'text':
      default:
        return token.text
    }
  })
}

/**
 * Secure shared Markdown message renderer for EONPAI and general chat bubbles.
 * - Safely converts Markdown into React Virtual DOM elements without dangerouslySetInnerHTML.
 * - Supports headings, lists, inline formatting, code blocks, and links.
 * - Completely immune to XSS and raw HTML script injections.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null

  const blocks: MarkdownBlock[] = parseMarkdownBlocks(content)

  return (
    <div className={`md-renderer ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const children = renderInlineMarkdown(block.text)
            if (block.level === 1) {
              return (
                <h3 key={idx} className="md-heading md-h1">
                  {children}
                </h3>
              )
            }
            if (block.level === 2) {
              return (
                <h4 key={idx} className="md-heading md-h2">
                  {children}
                </h4>
              )
            }
            if (block.level === 3) {
              return (
                <h5 key={idx} className="md-heading md-h3">
                  {children}
                </h5>
              )
            }
            return (
              <h6 key={idx} className="md-heading md-h4">
                {children}
              </h6>
            )
          }

          case 'codeblock': {
            return (
              <div key={idx} className="md-codeblock-wrapper">
                {block.language && (
                  <div className="md-codeblock-header">
                    <span className="md-codeblock-lang">{block.language}</span>
                  </div>
                )}
                <pre className="md-codeblock">
                  <code>{block.code}</code>
                </pre>
              </div>
            )
          }

          case 'ul': {
            return (
              <ul key={idx} className="md-list md-ul">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="md-list-item">
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ul>
            )
          }

          case 'ol': {
            return (
              <ol key={idx} className="md-list md-ol">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="md-list-item">
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ol>
            )
          }

          case 'blockquote': {
            return (
              <blockquote key={idx} className="md-blockquote">
                {renderInlineMarkdown(block.text)}
              </blockquote>
            )
          }

          case 'hr': {
            return <hr key={idx} className="md-hr" />
          }

          case 'paragraph': {
            const lines = block.text.split('\n')
            return (
              <p key={idx} className="md-paragraph">
                {lines.map((lineText, lineIdx) => (
                  <React.Fragment key={lineIdx}>
                    {renderInlineMarkdown(lineText)}
                    {lineIdx < lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            )
          }

          default:
            return null
        }
      })}
    </div>
  )
}
