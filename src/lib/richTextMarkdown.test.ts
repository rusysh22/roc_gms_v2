import { describe, expect, it } from 'vitest'

import { lexicalContentToMarkdownLite, markdownLiteToLexicalContent } from './richTextMarkdown'

// Regression coverage for AUDIT_E2E CNT-02: markdownLiteToLexicalContent must produce real Lexical
// heading/list/link/bold nodes (not just flat paragraphs), and lexicalContentToMarkdownLite must
// be able to read them back without losing that structure - the whole point of the fix.
describe('markdownLiteToLexicalContent', () => {
  it('produces a heading node for a "# " line', () => {
    const content = markdownLiteToLexicalContent('# Match Preview')
    const [node] = content.root.children
    expect(node.type).toBe('heading')
    expect((node as { tag?: string }).tag).toBe('h1')
    expect(node.children![0].text).toBe('Match Preview')
  })

  it('produces bold and link inline nodes inside a paragraph', () => {
    const content = markdownLiteToLexicalContent('This is **bold** and a [link](https://example.com).')
    const [node] = content.root.children
    expect(node.type).toBe('paragraph')

    const boldNode = node.children!.find((child) => child.text === 'bold')
    expect((boldNode as { format?: number }).format).toBe(1)

    const linkNode = node.children!.find((child) => child.type === 'link')
    expect(linkNode).toBeDefined()
    expect((linkNode as { fields?: { url?: string } }).fields?.url).toBe('https://example.com')
    expect(linkNode?.children?.[0]?.text).toBe('link')
  })

  it('produces a bullet list node when every line starts with "- "', () => {
    const content = markdownLiteToLexicalContent('- First item\n- Second item')
    const [node] = content.root.children
    expect(node.type).toBe('list')
    expect((node as { listType?: string }).listType).toBe('bullet')
    expect(node.children).toHaveLength(2)
    expect(node.children![0].type).toBe('listitem')
    expect(node.children![0].children![0].text).toBe('First item')
  })

  it('separates blank-line blocks into distinct paragraphs, same as before', () => {
    const content = markdownLiteToLexicalContent('First paragraph.\n\nSecond paragraph.')
    expect(content.root.children).toHaveLength(2)
    expect(content.root.children[0].type).toBe('paragraph')
    expect(content.root.children[1].type).toBe('paragraph')
  })
})

describe('lexicalContentToMarkdownLite', () => {
  it('round-trips heading, bold, link, and list content', () => {
    const source = '# Title\n\nA **bold** claim with a [link](https://example.com).\n\n- One\n- Two'
    const roundTripped = lexicalContentToMarkdownLite(markdownLiteToLexicalContent(source))

    expect(roundTripped).toContain('# Title')
    expect(roundTripped).toContain('**bold**')
    expect(roundTripped).toContain('[link](https://example.com)')
    expect(roundTripped).toContain('- One')
    expect(roundTripped).toContain('- Two')
  })
})
