import type { Metadata } from 'next'

type ShareMetadataInput = {
  title: string
  description: string
  path?: string
  imageUrl?: string
}

export const getPublicBaseUrl = () => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

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
}: ShareMetadataInput): Metadata => {
  const url = path ? getAbsolutePublicUrl(path) : getPublicBaseUrl()
  const image = imageUrl ? getAbsolutePublicUrl(imageUrl) : undefined

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
      type: 'article',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}
