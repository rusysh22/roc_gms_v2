import { getPayload, type Where } from 'payload'

import config from '@payload-config'
import type { RelationshipDoc } from './workspaces/workspaceComponents'

export type MediaDoc = RelationshipDoc & {
  alt?: string | null
  caption?: string | null
  url?: string | null
  filename?: string | null
  mimeType?: string | null
}

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

export type PublicArticle = {
  id: string | number
  title: string
  slug: string
  excerpt: string
  content?: LexicalContent | null
  status: string
  published_at?: string | null
  cover_image?: MediaDoc | string | number | null
  share_title?: string | null
  share_description?: string | null
  share_image?: MediaDoc | string | number | null
  canonical_url?: string | null
  comments_enabled?: boolean | null
  event_id?: RelationshipDoc | string | number | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  match_id?: RelationshipDoc | string | number | null
  createdAt?: string
  updatedAt?: string
}

export type PublicAnnouncement = {
  id: string | number
  title: string
  slug: string
  summary: string
  body: string
  urgency: string
  display_mode: string
  status: string
  target_scope: string
  published_at?: string | null
  expires_at?: string | null
  cta_label?: string | null
  cta_url?: string | null
  share_title?: string | null
  share_description?: string | null
  share_image?: MediaDoc | string | number | null
  event_id?: RelationshipDoc | string | number | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  match_id?: RelationshipDoc | string | number | null
}

export const getRelationshipId = (value: RelationshipDoc | string | number | null | undefined) => {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return value.id
}

export const getMedia = (value: MediaDoc | string | number | null | undefined) =>
  value && typeof value === 'object' ? value : undefined

export const getMediaUrl = (value: MediaDoc | string | number | null | undefined) => {
  const media = getMedia(value)
  return media?.url || ''
}

export const formatContentDate = (value?: string | null) => {
  if (!value) {
    return 'Published date pending'
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
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

export const renderLexicalParagraphs = (content?: LexicalContent | null) => {
  const paragraphs =
    content?.root?.children
      ?.map((node) => getPlainTextFromLexical({ root: node }))
      .filter(Boolean) || []

  return paragraphs
}

const publishedAtVisible = (nowIso: string): Where => ({
  published_at: {
    less_than_equal: nowIso,
  },
})

const publicArticleWhere = (nowIso: string): Where => ({
  and: [{ status: { equals: 'published' } }, publishedAtVisible(nowIso)],
})

const publicAnnouncementWhere = (nowIso: string): Where => ({
  and: [
    { status: { equals: 'published' } },
    publishedAtVisible(nowIso),
    {
      or: [{ expires_at: { exists: false } }, { expires_at: { greater_than: nowIso } }],
    },
  ],
})

export const getPublicArticles = async (limit = 20) => {
  const payload = await getPayload({ config })

  const articles = await payload.find({
    collection: 'articles',
    depth: 2,
    limit,
    sort: '-published_at',
    where: publicArticleWhere(new Date().toISOString()),
  })

  return articles.docs as PublicArticle[]
}

export const getPublicArticleBySlug = async (slug: string) => {
  const payload = await getPayload({ config })

  const articles = await payload.find({
    collection: 'articles',
    depth: 2,
    limit: 1,
    where: {
      and: [{ slug: { equals: slug } }, publicArticleWhere(new Date().toISOString())],
    },
  })

  return articles.docs[0] as PublicArticle | undefined
}

export const getPublicAnnouncements = async (limit = 20) => {
  const payload = await getPayload({ config })

  const announcements = await payload.find({
    collection: 'announcements',
    depth: 2,
    limit,
    sort: ['-published_at', 'urgency'],
    where: publicAnnouncementWhere(new Date().toISOString()),
  })

  return announcements.docs as PublicAnnouncement[]
}

export const getScopedPublicAnnouncements = async ({
  eventId,
  sportId,
  categoryId,
  matchId,
  limit = 6,
}: {
  eventId?: string | number
  sportId?: string | number
  categoryId?: string | number
  matchId?: string | number
  limit?: number
}) => {
  const payload = await getPayload({ config })
  const scopeFilters: Where[] = []

  if (matchId) {
    scopeFilters.push({ and: [{ target_scope: { equals: 'match' } }, { match_id: { equals: matchId } }] })
  }
  if (categoryId) {
    scopeFilters.push({
      and: [{ target_scope: { equals: 'category' } }, { category_id: { equals: categoryId } }],
    })
  }
  if (sportId) {
    scopeFilters.push({ and: [{ target_scope: { equals: 'sport' } }, { sport_id: { equals: sportId } }] })
  }
  if (eventId) {
    scopeFilters.push({ and: [{ target_scope: { equals: 'event' } }, { event_id: { equals: eventId } }] })
  }

  if (scopeFilters.length === 0) {
    return []
  }

  const announcements = await payload.find({
    collection: 'announcements',
    depth: 2,
    limit,
    sort: ['-published_at', 'urgency'],
    where: {
      and: [publicAnnouncementWhere(new Date().toISOString()), { or: scopeFilters }],
    },
  })

  return announcements.docs as PublicAnnouncement[]
}

export const getRelatedPublicArticles = async ({
  eventId,
  sportId,
  categoryId,
  matchId,
  limit = 3,
}: {
  eventId?: string | number
  sportId?: string | number
  categoryId?: string | number
  matchId?: string | number
  limit?: number
}) => {
  const payload = await getPayload({ config })
  const scopeFilters: Where[] = []

  if (matchId) {
    scopeFilters.push({ match_id: { equals: matchId } })
  }
  if (categoryId) {
    scopeFilters.push({ category_id: { equals: categoryId } })
  }
  if (sportId) {
    scopeFilters.push({ sport_id: { equals: sportId } })
  }
  if (eventId) {
    scopeFilters.push({ event_id: { equals: eventId } })
  }

  if (scopeFilters.length === 0) {
    return []
  }

  const articles = await payload.find({
    collection: 'articles',
    depth: 2,
    limit,
    sort: '-published_at',
    where: {
      and: [publicArticleWhere(new Date().toISOString()), { or: scopeFilters }],
    },
  })

  return articles.docs as PublicArticle[]
}
