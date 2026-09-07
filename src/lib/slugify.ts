// Shared URL-slug generator. Same rules the workspace CRUD actions have each re-inlined
// (clubActions, sportActions, categoryActions, the New Event wizard): lowercase, strip diacritics,
// non-alphanumerics collapse to a single hyphen, trimmed, capped at 80 chars.
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
