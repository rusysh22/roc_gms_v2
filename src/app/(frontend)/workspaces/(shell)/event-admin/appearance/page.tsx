import { AlertBanner } from '@/components/ui/alert-banner'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/ui/file-upload'
import { DEFAULT_EVENT_THEME_PRESET, EVENT_THEME_PRESETS } from '@/lib/eventTheme'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveAppearanceAction } from './appearanceActions'

export const dynamic = 'force-dynamic'

const appearanceErrorMessages: Record<string, string> = {
  invalid_preset: 'Choose one of the color combinations below.',
  invalid_image: 'That file is not an image. Upload a JPG, PNG, or WebP.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

// `ActiveEventDoc` only declares the base scalar fields every caller of getActiveEvent needs -
// this page asks for `depth: 1` so the row it gets back also has these two populated, but still
// needs its own wider type to read them off (the runtime object already has them either way).
type AppearanceEventDoc = {
  logo?: { url?: string; alt?: string } | string | number | null
  banner_image?: { url?: string; alt?: string } | string | number | null
  theme_config?: { preset?: string } | null
}

export default async function AppearancePage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin/appearance',
    workspaceName: 'Event Appearance',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const event = await getActiveEvent(access.payload, 1)
  if (!event) {
    return (
      <>
        <PageHero
          eyebrow="Event Setup"
          title="Appearance"
          summary="Set the hero image and color theme shown on this event's public page."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const appearanceError = get(params, 'appearanceError')
  const appearanceUpdated = get(params, 'appearanceUpdated')

  const fullEvent = event as unknown as AppearanceEventDoc
  const logoImage =
    fullEvent.logo && typeof fullEvent.logo === 'object' ? (fullEvent.logo as { url?: string; alt?: string }) : undefined
  const bannerImage =
    fullEvent.banner_image && typeof fullEvent.banner_image === 'object'
      ? (fullEvent.banner_image as { url?: string; alt?: string })
      : undefined
  const themeConfig = fullEvent.theme_config
  const currentPreset = themeConfig?.preset || DEFAULT_EVENT_THEME_PRESET

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Appearance"
        summary="Set the hero image and color theme shown on this event's public page."
      />

      {appearanceError && appearanceErrorMessages[appearanceError] ? (
        <AlertBanner tone="error" className="mb-4">
          {appearanceErrorMessages[appearanceError]}
        </AlertBanner>
      ) : null}
      {appearanceUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved. Changes are live on the public event page.
        </AlertBanner>
      ) : null}

      <form action={saveAppearanceAction} className="flex flex-col gap-6">
        {/* AUDIT_UI_UX_CSS ADM-04/ADM-05: the wizard's copy already promises "logo can be added
            later," and the `logo` field/public rendering (events/[eventSlug]/page.tsx) already
            exist - only this admin form was missing the field to actually set it. */}
        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Event logo</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">
              Shown next to the event name on the public page and in shared links. Optional -
              square or wide logos both work.
            </p>
          </div>
          <FileUpload
            id="event-logo-upload"
            name="logoImage"
            accept="image/*"
            maxSizeBytes={4 * 1024 * 1024}
            existingPreviewUrl={logoImage?.url}
            existingLabel="Current logo"
            showRemoveOption
            removeFieldName="removeLogo"
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Hero image</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">
              Shown behind the headline on your public event page. Uploaded images are compressed
              and resized automatically.
            </p>
          </div>
          <FileUpload
            id="event-hero-upload"
            name="heroImage"
            accept="image/*"
            maxSizeBytes={8 * 1024 * 1024}
            existingPreviewUrl={bannerImage?.url}
            existingLabel="Current hero image"
            showRemoveOption
            removeFieldName="removeImage"
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Color theme</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">
              Pick one of these pre-tuned combinations for your public event page. Only the
              hero CTA, links, and accent icons change - status colors (live/win/scheduled)
              always stay the same everywhere, so a theme can never make a result look like an
              error.
            </p>
          </div>
          {/* AUDIT_UI_UX_CSS ADM-06: color swatches alone don't show what a preset actually does
              to real components - an admin had to save and go look at the public page to find
              out. Each option now renders a small live sample of the two things a theme actually
              touches (the primary CTA button and a text link), styled with that preset's own
              colors via inline style so all three can be compared side by side regardless of
              which one is currently active. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(EVENT_THEME_PRESETS).map(([key, preset]) => (
              <label key={key} className="cursor-pointer">
                <input
                  type="radio"
                  name="preset"
                  value={key}
                  defaultChecked={currentPreset === key}
                  className="peer sr-only"
                />
                <div className="flex flex-col gap-3 rounded-card border-2 border-line p-4 transition-colors peer-checked:border-green peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-green">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: preset.colors.primary }}
                    >
                      View event
                    </span>
                    <span
                      className="text-xs font-semibold underline underline-offset-2"
                      style={{ color: preset.colors.secondary }}
                    >
                      See schedule
                    </span>
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: preset.colors.accent }}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{preset.label}</p>
                    <p className="text-xs text-ink-soft">{preset.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <div>
          <SubmitButton>Save appearance</SubmitButton>
        </div>
      </form>
    </>
  )
}
