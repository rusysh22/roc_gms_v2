# InTourney Docs (`docs.intourney.id`)

A standalone [Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/) site that
publishes the InTourney user documentation. It is **deployed separately** from the main InTourney
application — its own project, its own domain, no shared build.

```
intourney.id        → the InTourney app (Next.js + Payload)
docs.intourney.id   → this site (static HTML)
```

## Content

Every page is a Markdown file in [`src/content/docs/`](src/content/docs/). Editing docs = editing
those files. Reading order and sidebar grouping are defined in [`astro.config.mjs`](astro.config.mjs)
(`starlight.sidebar`), not by filename.

Internal links use root-relative slugs, e.g. `[Reference](/reference/)`.

## Local development

Requires Node 20.3+, 22, or 24 (this repo uses Node 24).

```bash
cd docs-site
npm install
npm run dev        # http://localhost:4321
```

## Build

```bash
npm run build      # outputs static site to docs-site/dist/
npm run preview    # serve the built site locally
```

`npm run build` also fails on broken internal links, so it doubles as a link check in CI.

## Deploy

The output in `dist/` is plain static files — host it anywhere. Recommended: **Cloudflare Pages**
(free, fast, automatic HTTPS, no config).

### Cloudflare Pages (recommended)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick this repository.
3. Build settings:
   | Setting | Value |
   |---|---|
   | Framework preset | `Astro` |
   | Root directory | `docs-site` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version (env var `NODE_VERSION`) | `24` |
4. Deploy. You get a `*.pages.dev` URL to verify.

### Custom domain

1. In the Pages project → **Custom domains** → **Set up a custom domain** → `docs.intourney.id`.
2. Cloudflare adds the DNS record for you if `intourney.id` is on Cloudflare. Otherwise add it
   manually at your DNS provider:

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | `CNAME` | `docs` | `<project-name>.pages.dev` | on (Cloudflare) / n/a (others) |

3. HTTPS is issued automatically within a few minutes.

### Vercel / Netlify (alternative)

Same idea — import the repo, set **Root Directory** to `docs-site`, framework **Astro**, then add
`docs.intourney.id` as a domain and point a `CNAME docs` record at the provider's target
(`cname.vercel-dns.com` for Vercel; the Netlify subdomain for Netlify).

## Keeping `site` correct

[`astro.config.mjs`](astro.config.mjs) sets `site: 'https://docs.intourney.id'`. This is used for
canonical URLs, `sitemap.xml`, and social/OG tags — update it if the domain ever changes.
