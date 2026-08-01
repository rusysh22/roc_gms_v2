// Pure Lexical <-> markdown-lite conversion, split out of contentData.ts so it can be unit tested
// without pulling in that file's `@payload-config` import (see richTextMarkdown.test.ts).

export type LexicalTextNode = {
  type: 'text'
  text?: string
}

export type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
}

export type LexicalContent = {
  root?: LexicalNode
}

export const getPlainTextFromLexical = (content?: LexicalContent | null) => {
  const parts: string[] = []
  const visit = (node?: LexicalNode) => {
    if (!node) {
      return
    }

    if (node.type === 'text' && node.text) {
      parts.push(node.text)
    }

    for (const child of node.children || []) {
      visit(child)
    }
  }

  visit(content?.root)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// Retained for plain-text needs (meta descriptions, excerpts) where flattening is exactly what's
// wanted - this is not the AUDIT_E2E CNT-02 bug by itself, only using it to display/round-trip the
// actual article *body* was (see markdownLiteToLexicalContent/lexicalContentToMarkdownLite below).
export const renderLexicalParagraphs = (content?: LexicalContent | null) => {
  const paragraphs =
    content?.root?.children
      ?.map((node) => getPlainTextFromLexical({ root: node }))
      .filter(Boolean) || []

  return paragraphs
}

// AUDIT_E2E CNT-02: the in-app content editor used to be a plain textarea that only ever produced
// flat paragraph nodes (plainTextToLexicalContent) and only ever rendered flat paragraph text back
// (renderLexicalParagraphs) - editing an article through the workspace silently destroyed any
// heading/list/bold/link formatting, including formatting created through Payload Admin's real
// Lexical editor (the richText field itself is genuine Lexical - only this app's own editor/
// renderer were lossy).
//
// Building a full WYSIWYG editor is a separate, larger UI project. Instead, the plain textarea
// stays (matches this app's existing simple-tools design), but now understands a small, explicit
// markdown-lite dialect - '# '/'## '/'### ' headings, '- ' bullet lists, **bold**, [text](url)
// links - and both directions produce/consume *real* Lexical heading/list/text-format/link nodes
// (shapes verified against @payloadcms/richtext-lexical's own test fixtures), which the public
// site's actual RichText renderer (contentComponents.tsx's ArticleRichText) now displays properly.
//
// Known limitation: content authored with elements this dialect doesn't cover (tables, images,
// blockquotes, nested lists) will degrade to plain text if it's re-edited through this textarea -
// only re-saving from Payload Admin's own editor preserves those. That's an explicit, documented
// gap, not a silent one.
const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/
const LIST_ITEM_PATTERN = /^[-*]\s+(.*)$/
const INLINE_TOKEN_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

type LexicalTextFormatNode = {
  type: 'text'
  version: 1
  text: string
  format: number
  detail: 0
  mode: 'normal'
  style: ''
}

type LexicalLinkNode = {
  type: 'link'
  version: 2
  direction: 'ltr'
  format: ''
  indent: 0
  fields: { linkType: 'custom'; newTab: boolean; url: string }
  children: LexicalTextFormatNode[]
}

const makeTextNode = (text: string, bold: boolean): LexicalTextFormatNode => ({
  type: 'text',
  version: 1,
  text,
  format: bold ? 1 : 0,
  detail: 0,
  mode: 'normal',
  style: '',
})

/** Splits a line into text/link nodes, handling **bold** and [text](url) - not nested (no bold
 * inside a link or vice versa), which covers the vast majority of real editorial use. */
const parseInline = (line: string): (LexicalTextFormatNode | LexicalLinkNode)[] => {
  const nodes: (LexicalTextFormatNode | LexicalLinkNode)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  INLINE_TOKEN_PATTERN.lastIndex = 0
  while ((match = INLINE_TOKEN_PATTERN.exec(line))) {
    if (match.index > lastIndex) {
      nodes.push(makeTextNode(line.slice(lastIndex, match.index), false))
    }

    if (match[1] !== undefined) {
      nodes.push(makeTextNode(match[1], true))
    } else {
      nodes.push({
        type: 'link',
        version: 2,
        direction: 'ltr',
        format: '',
        indent: 0,
        fields: { linkType: 'custom', newTab: false, url: match[3] },
        children: [makeTextNode(match[2], false)],
      })
    }

    lastIndex = INLINE_TOKEN_PATTERN.lastIndex
  }

  if (lastIndex < line.length) {
    nodes.push(makeTextNode(line.slice(lastIndex), false))
  }

  return nodes.length > 0 ? nodes : [makeTextNode('', false)]
}

/** Precise return shape for markdownLiteToLexicalContent - stricter than the loose, exported
 * LexicalContent type (which allows `root` to be entirely absent, for arbitrary Payload JSON this
 * module doesn't control) since this function always produces a real root/children. */
export type LexicalRootContent = {
  root: {
    type: 'root'
    version: 1
    direction: 'ltr'
    format: ''
    indent: 0
    children: LexicalNode[]
  }
}

const makeElementNode = (type: 'paragraph' | 'heading', children: LexicalNode[], tag?: string) => ({
  type,
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  ...(tag ? { tag } : {}),
  children,
})

export const markdownLiteToLexicalContent = (text: string): LexicalRootContent => {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  const children: LexicalNode[] = blocks.map((block) => {
    const headingMatch = block.match(HEADING_PATTERN)
    if (headingMatch) {
      return makeElementNode('heading', parseInline(headingMatch[2]), `h${headingMatch[1].length}`)
    }

    const lines = block.split('\n').map((line) => line.trim())
    if (lines.length > 0 && lines.every((line) => LIST_ITEM_PATTERN.test(line))) {
      const listItems: LexicalNode[] = lines.map((line) => ({
        type: 'listitem',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        checked: false,
        value: 1,
        children: parseInline(line.match(LIST_ITEM_PATTERN)![1]),
      }))
      return {
        type: 'list',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        children: listItems,
      }
    }

    return makeElementNode('paragraph', parseInline(block))
  })

  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: children.length > 0 ? children : [makeElementNode('paragraph', [makeTextNode('', false)])],
    },
  }
}

const inlineNodesToMarkdown = (nodes: LexicalNode[] | undefined): string =>
  (nodes || [])
    .map((node) => {
      if (node.type === 'link') {
        const url = (node as unknown as { fields?: { url?: string } }).fields?.url || ''
        return `[${inlineNodesToMarkdown(node.children)}](${url})`
      }
      if (node.type === 'text') {
        const format = (node as unknown as { format?: number }).format ?? 0
        const isBold = (format & 1) !== 0
        return isBold ? `**${node.text || ''}**` : node.text || ''
      }
      return inlineNodesToMarkdown(node.children)
    })
    .join('')

/** Reverse of markdownLiteToLexicalContent, used to pre-fill the workspace edit textarea without
 * flattening headings/lists/bold/links back to plain text. */
export const lexicalContentToMarkdownLite = (content?: LexicalContent | null): string => {
  const blocks = (content?.root?.children || []).map((node) => {
    if (node.type === 'heading') {
      const level = Number((node as unknown as { tag?: string }).tag?.replace('h', '')) || 1
      return `${'#'.repeat(level)} ${inlineNodesToMarkdown(node.children)}`
    }
    if (node.type === 'list') {
      return (node.children || [])
        .map((item) => `- ${inlineNodesToMarkdown(item.children)}`)
        .join('\n')
    }
    return inlineNodesToMarkdown(node.children)
  })

  return blocks.filter(Boolean).join('\n\n')
}
