'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useSearchParams } from 'next/navigation'
import { Lock, Shuffle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { createQuickBracketAction } from './quickBracketActions'

const MIN_PARTICIPANTS = 2
const MAX_PARTICIPANTS = 64
const LOCKED_FORMATS = ['Round Robin', 'Swiss', 'Group + Playoff', 'League']

// Client-side copy of matchGeneration.ts's getNextPowerOfTwo - duplicated rather than imported so
// this client bundle never pulls in a server-oriented module (matchGeneration.ts also exports
// Payload-writing functions with a `Payload` type import).
const getNextPowerOfTwo = (value: number) => (value <= 1 ? 1 : 2 ** Math.ceil(Math.log2(value)))
const isExactPowerOfTwo = (value: number) => value >= 2 && (value & (value - 1)) === 0

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: "You've created a few of these already from this connection - try again in a bit.",
  bot_check_failed: 'Bot check failed - please try again.',
  missing_name: 'Give your tournament a name.',
  invalid_format: 'Choose a tournament format.',
  invalid_size_mode: 'Choose how to set the bracket size.',
  invalid_participant_count: `Enter between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} participants.`,
  double_elimination_requires_power_of_two:
    'Double elimination needs an exact power-of-two number of participants (4, 8, 16, 32, or 64).',
  invalid_bracket_size: `Enter a bracket size between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS}.`,
}

const RoundOnePreview = ({ size, names }: { size: number; names: string[] }) => {
  const matchCount = Math.max(size / 2, 1)
  const shown = Math.min(matchCount, 8)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        Round 1 &middot; {matchCount} {matchCount === 1 ? 'match' : 'matches'}
      </p>
      <div className="grid gap-2">
        {Array.from({ length: shown }, (_, index) => (
          <div key={index} className="rounded-card border border-line bg-paper px-3 py-2">
            <p className="truncate text-xs font-semibold text-ink">{names[index * 2] || 'TBD'}</p>
            <p className="my-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink-soft">vs</p>
            <p className="truncate text-xs font-semibold text-ink">{names[index * 2 + 1] || 'TBD'}</p>
          </div>
        ))}
      </div>
      {matchCount > shown ? (
        <p className="text-xs text-ink-soft">+{matchCount - shown} more first-round matches</p>
      ) : null}
    </div>
  )
}

export const QuickBracketForm = () => {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error')

  const [format, setFormat] = useState<'single_elimination' | 'double_elimination'>('single_elimination')
  const [thirdPlace, setThirdPlace] = useState(false)
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)
  const [bracketSizeMode, setBracketSizeMode] = useState<'from_participants' | 'manual_size'>(
    'from_participants',
  )
  const [participantsText, setParticipantsText] = useState('')
  const [manualSize, setManualSize] = useState('8')

  const participantNames = useMemo(
    () =>
      participantsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [participantsText],
  )
  const previewSize =
    bracketSizeMode === 'from_participants'
      ? getNextPowerOfTwo(participantNames.length)
      : getNextPowerOfTwo(Number(manualSize) || 0)
  const previewNames = bracketSizeMode === 'from_participants' ? participantNames : []
  const doubleElimNeedsPowerOfTwo =
    format === 'double_elimination' &&
    bracketSizeMode === 'from_participants' &&
    participantNames.length > 0 &&
    !isExactPowerOfTwo(participantNames.length)

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const handleRandomize = () => {
    const shuffled = [...participantNames]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setParticipantsText(shuffled.join('\n'))
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <form action={createQuickBracketAction} className="flex flex-col gap-8">
        {/* Honeypot: a real visitor never sees or fills this field. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="qb-website">Website</label>
          <input id="qb-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {errorCode ? (
          <p className="rounded-card border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
            {ERROR_MESSAGES[errorCode] || 'Something went wrong - please check the form and try again.'}
          </p>
        ) : null}

        <div>
          <Label htmlFor="qb-name">Tournament name</Label>
          <Input id="qb-name" name="name" required maxLength={120} placeholder="e.g. Friday Futsal Cup" />
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Format</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  value: 'single_elimination' as const,
                  title: 'Single Elimination',
                  description: 'One loss and you are out.',
                },
                {
                  value: 'double_elimination' as const,
                  title: 'Double Elimination',
                  description:
                    'Lose once, fight back through the losers bracket. The grand final is a single match - no bracket reset.',
                },
              ]
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-card border p-4 transition-colors',
                  format === option.value ? 'border-green bg-mist' : 'border-line bg-paper hover:border-green/50',
                )}
              >
                <input
                  type="radio"
                  name="format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => setFormat(option.value)}
                  className="sr-only"
                />
                <span className="text-sm font-extrabold text-ink">{option.title}</span>
                <span className="text-xs text-ink-soft">{option.description}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {LOCKED_FORMATS.map((lockedFormat) => (
              <span
                key={lockedFormat}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line bg-mist px-3 py-1 text-xs font-semibold text-ink-soft"
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                {lockedFormat}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            Other tournament types unlock when you sign up on InTourney.
          </p>
        </div>

        {format === 'single_elimination' ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="third_place"
              checked={thirdPlace}
              onChange={(event) => setThirdPlace(event.target.checked)}
              className="h-4 w-4 rounded border-line text-green focus-visible:ring-2 focus-visible:ring-green/30"
            />
            Include a match for 3rd place
          </label>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                name="split_participants"
                disabled
                className="h-4 w-4 rounded border-line opacity-50"
              />
              <span className="text-sm font-semibold text-ink-soft">
                Enable split participants - start with half of participants in the losers bracket
              </span>
              <span className="rounded-full bg-mist px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft">
                Coming soon
              </span>
              <button
                type="button"
                onClick={() => setLearnMoreOpen((value) => !value)}
                className="text-xs font-bold text-blue underline-offset-2 hover:underline"
              >
                Learn more
              </button>
            </div>
            {learnMoreOpen ? (
              <div className="mt-2 rounded-card border border-line bg-mist p-3 text-xs leading-relaxed text-ink-soft">
                Normally every participant starts in the winners bracket. With split participants, the
                field is divided in half: the top half plays a mini winners-bracket run while the bottom
                half starts directly in the losers bracket and plays each other first - the two groups
                merge once their rounds line up. This changes the shape of the draw, and we are still
                finishing the bracket math for it.
              </div>
            ) : null}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Bracket size</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="radio"
                name="bracket_size_mode"
                value="from_participants"
                checked={bracketSizeMode === 'from_participants'}
                onChange={() => setBracketSizeMode('from_participants')}
                className="h-4 w-4 border-line text-green"
              />
              Use the number of participants provided below
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="radio"
                name="bracket_size_mode"
                value="manual_size"
                checked={bracketSizeMode === 'manual_size'}
                onChange={() => setBracketSizeMode('manual_size')}
                className="h-4 w-4 border-line text-green"
              />
              Enter a number and generate a blank bracket
            </label>
          </div>
        </div>

        {bracketSizeMode === 'from_participants' ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label htmlFor="qb-participants" className="mb-0">
                Participants
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRandomize}
                disabled={participantNames.length < 2}
              >
                <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                Randomize seeds
              </Button>
            </div>
            <Textarea
              id="qb-participants"
              name="participants"
              rows={10}
              value={participantsText}
              onChange={(event) => setParticipantsText(event.target.value)}
              placeholder={'Alex\nJordan\nSam\n...'}
            />
            <p className="mt-1 text-xs text-ink-soft">
              One per line, ordered by seed from best to worst. {participantNames.length}/{MAX_PARTICIPANTS}{' '}
              entered.
            </p>
            {doubleElimNeedsPowerOfTwo ? (
              <p className="mt-1 text-xs font-semibold text-danger">
                Double elimination needs an exact power-of-two number of participants (4, 8, 16, 32, 64).
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <Label htmlFor="qb-manual-size">Number of bracket slots</Label>
            <Input
              id="qb-manual-size"
              name="manual_size"
              type="number"
              min={MIN_PARTICIPANTS}
              max={MAX_PARTICIPANTS}
              value={manualSize}
              onChange={(event) => setManualSize(event.target.value)}
              className="max-w-32"
            />
            <p className="mt-1 text-xs text-ink-soft">
              Generates an empty bracket with this many slots - fill in real names later after signing up.
            </p>
          </div>
        )}

        {turnstileSiteKey ? (
          <div>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" async defer />
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
          </div>
        ) : null}

        <SubmitButton size="default" className="self-start" pendingLabel="Generating bracket...">
          Generate bracket
        </SubmitButton>
        <p className="text-xs text-ink-soft">
          By generating a bracket, you agree to our{' '}
          <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <div className="lg:sticky lg:top-24">
        <div className="rounded-panel border border-line bg-mist p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Preview</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{previewSize}-slot bracket</p>
          <p className="mt-1 text-xs text-ink-soft">
            {format === 'single_elimination' ? 'Single elimination' : 'Double elimination'}
            {thirdPlace && format === 'single_elimination' ? ' · 3rd place match' : ''}
          </p>
          <div className="mt-4 border-t border-line pt-4">
            <RoundOnePreview size={previewSize} names={previewNames} />
          </div>
        </div>
      </div>
    </div>
  )
}
