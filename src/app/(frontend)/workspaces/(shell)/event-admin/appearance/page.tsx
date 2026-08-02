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
              Pick one of these pre-tuned combinations for your public event page.
            </p>
          </div>
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
                  <div className="flex gap-1.5">
                    {Object.values(preset.colors).map((color) => (
                      <span
                        key={color}
                        className="h-8 w-8 rounded-full border border-line"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                    ))}
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
