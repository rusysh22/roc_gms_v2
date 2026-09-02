import type { Metadata } from 'next'

type ShareMetadataInput = {
  title: string
  description: string
  path?: string
  imageUrl?: string
  /** Open Graph object type. Defaults to 'article' (blog-style posts); pass 'website' for hubs. */
  type?: 'article' | 'website'
}

export const getPublicBaseUrl = () => {
  // NEXT_PUBLIC_SERVER_URL is the one actually set in this project's env (.env / docker-compose /
  // prod) - it MUST come first, otherwise metadataBase + every canonical/og:url/og:image falls
  // back to localhost and social crawlers (WhatsApp, Meta, ...) can't fetch the share image.
  const configuredUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    'http://localhost:3000'

  return configuredUrl.replace(/\/$/, '')
}

export const getAbsolutePublicUrl = (pathOrUrl: string) => {
  if (!pathOrUrl) {
    return getPublicBaseUrl()
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl
  }

  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${getPublicBaseUrl()}${path}`
}

export const buildShareMetadata = ({
  title,
  description,
  path,
  imageUrl,
  type = 'article',
}: ShareMetadataInput): Metadata => {
  const url = path ? getAbsolutePublicUrl(path) : getPublicBaseUrl()
  const image = imageUrl ? getAbsolutePublicUrl(imageUrl) : undefined

  // `images` is left undefined when there's no explicit override so Next falls back to the
  // co-located `opengraph-image` / `twitter-image` for this route (or the site default). The card
  // is always `summary_large_image` because every route resolves to a 1200x630 InTourney card.
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type,
      siteName: 'InTourney',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}
