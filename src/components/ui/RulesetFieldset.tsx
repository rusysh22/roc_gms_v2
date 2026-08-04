import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

// MSG-08: the full set of Rulesets fields that actually affect scheduling (default_duration_minutes,
// min_rest_minutes) and standings (points_win/draw/loss, tie_breakers) - fields that used to only
// exist in the wizard's 4-field quick form or in Payload admin, so a ruleset "finished" in the
// wizard silently left the optimizer/standings running on defaults. One shared fieldset used by
// both the sport catalog dialog and the dedicated ruleset edit page
// (/workspaces/event-admin/rulesets) - same layout and labels wherever a ruleset is edited.
//
// Server-renderable (no client state) - every field here is a plain named input read back via
// FormData by the caller's server action, same as the rest of this codebase's forms.

const SCORE_TYPES = [
  { value: 'points', label: 'Points' },
  { value: 'goals', label: 'Goals' },
  { value: 'sets', label: 'Sets' },
  { value: 'time', label: 'Time' },
  { value: 'result', label: 'Result' },
  { value: 'custom', label: 'Custom' },
]

const TIE_BREAKER_OPTIONS = [
  { value: '', label: '(none)' },
  { value: 'points', label: 'Points' },
  { value: 'head_to_head', label: 'Head-to-head' },
  { value: 'score_difference', label: 'Score difference' },
  { value: 'score_for', label: 'Score for' },
  { value: 'set_difference', label: 'Set difference' },
  { value: 'set_for', label: 'Set for' },
  { value: 'fewest_penalties', label: 'Fewest penalties' },
  { value: 'manual_decision', label: 'Manual decision' },
]

// A ranked list of up to 4 dropdowns (rather than a drag-to-reorder multi-select) - order matters
// for tie_breakers (first entry is applied first), and four ranked <select>s give that ordering
// with plain HTML form fields instead of client-side drag state.
const TIE_BREAKER_SLOTS = 4

export type RulesetFieldsetValues = {
  scoreType?: string | null
  setBased?: boolean | null
  bestOf?: number | null
  targetScore?: number | null
  maxScore?: number | null
  deuceEnabled?: boolean | null
  allowDraw?: boolean | null
  defaultDurationMinutes?: number | null
  minRestMinutes?: number | null
  pointsWin?: number | null
  pointsDraw?: number | null
  pointsLoss?: number | null
  tieBreakers?: string[] | null
}

export function RulesetFieldset({ values }: { values?: RulesetFieldsetValues }) {
  const tieBreakers = values?.tieBreakers ?? []

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-bold tracking-wide text-ink-soft uppercase">How to win</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Score type">
            <Select name="scoreType" defaultValue={values?.scoreType || 'points'}>
              {SCORE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Best of (sets)">
            <Input name="bestOf" type="number" min="1" defaultValue={values?.bestOf ?? ''} />
          </Field>
          <Field label="Points per set">
            <Input name="targetScore" type="number" min="0" defaultValue={values?.targetScore ?? ''} />
          </Field>
          <Field label="Max points">
            <Input name="maxScore" type="number" min="0" defaultValue={values?.maxScore ?? ''} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="setBased"
              defaultChecked={values?.setBased ?? false}
              className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
            />
            Set based
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="deuceEnabled"
              defaultChecked={values?.deuceEnabled ?? false}
              className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
            />
            Deuce - must win by 2 to close the set
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="allowDraw"
              defaultChecked={values?.allowDraw ?? false}
              className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
            />
            Allow a draw
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-bold tracking-wide text-ink-soft uppercase">Estimated timing</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Match duration (minutes)">
            <Input
              name="defaultDurationMinutes"
              type="number"
              min="1"
              defaultValue={values?.defaultDurationMinutes ?? ''}
            />
            <p className="mt-1 text-xs text-ink-soft">Used by the schedule optimizer to reserve a court.</p>
          </Field>
          <Field label="Minimum rest between matches (minutes)">
            <Input name="minRestMinutes" type="number" min="0" defaultValue={values?.minRestMinutes ?? ''} />
            <p className="mt-1 text-xs text-ink-soft">
              Keeps the same person from playing back-to-back - applies across sports too.
            </p>
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-bold tracking-wide text-ink-soft uppercase">Standings</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Points for a win">
            <Input name="pointsWin" type="number" min="0" step="0.5" defaultValue={values?.pointsWin ?? 3} />
          </Field>
          <Field label="Points for a draw">
            <Input name="pointsDraw" type="number" min="0" step="0.5" defaultValue={values?.pointsDraw ?? 1} />
          </Field>
          <Field label="Points for a loss">
            <Input name="pointsLoss" type="number" min="0" step="0.5" defaultValue={values?.pointsLoss ?? 0} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-ink">Tie-break order when points are equal</p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: TIE_BREAKER_SLOTS }).map((_, index) => (
              <Field key={index} label={`${index + 1}.`} className="max-w-xs">
                <Select name="tieBreaker" defaultValue={tieBreakers[index] || ''}>
                  {TIE_BREAKER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>
      </fieldset>
    </div>
  )
}
