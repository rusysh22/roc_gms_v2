import { describe, expect, it } from 'vitest'

import { deriveWizardProgress, type WizardProgressInput } from './wizardProgress'

const baseInput = (overrides: Partial<WizardProgressInput> = {}): WizardProgressInput => ({
  sportsCount: 0,
  categories: [],
  clubsCount: 0,
  teamsCount: 0,
  playersCount: 0,
  confirmedEntries: [],
  matches: [],
  groupStageIds: [],
  ...overrides,
})

describe('deriveWizardProgress', () => {
  it('treats a brand-new event (only the event row exists) as resuming at sports', () => {
    const progress = deriveWizardProgress(baseInput())
    expect(progress.completedSteps.has('event')).toBe(true)
    expect(progress.completedSteps.has('sports')).toBe(false)
    expect(progress.firstIncompleteStep).toBe('sports')
    expect(progress.completedTaskCount).toBe(0)
    expect(progress.isComplete).toBe(false)
  })

  it('advances the resume target as each step is satisfied', () => {
    expect(deriveWizardProgress(baseInput({ sportsCount: 2 })).firstIncompleteStep).toBe('categories')
    expect(
      deriveWizardProgress(
        baseInput({ sportsCount: 2, categories: [{ id: 1, status: 'draft', format_type: 'single_elimination' }] }),
      ).firstIncompleteStep,
    ).toBe('participants')
    expect(
      deriveWizardProgress(
        baseInput({
          sportsCount: 2,
          categories: [{ id: 1, status: 'draft', format_type: 'single_elimination' }],
          playersCount: 4,
        }),
      ).firstIncompleteStep,
    ).toBe('registration')
  })

  it('marks registration and draw done only once every non-draft category has >= 2 confirmed entries', () => {
    const input = baseInput({
      sportsCount: 1,
      categories: [
        { id: 1, status: 'open', format_type: 'single_elimination' },
        { id: 2, status: 'open', format_type: 'single_elimination' },
      ],
      playersCount: 8,
      confirmedEntries: [
        { category_id: 1 },
        { category_id: 1 },
        { category_id: 2 },
      ],
    })
    expect(deriveWizardProgress(input).completedSteps.has('registration')).toBe(false)
    expect(deriveWizardProgress(input).firstIncompleteStep).toBe('registration')

    input.confirmedEntries.push({ category_id: 2 })
    const ready = deriveWizardProgress(input)
    expect(ready.completedSteps.has('registration')).toBe(true)
    expect(ready.completedSteps.has('draw')).toBe(true)
    expect(ready.firstIncompleteStep).toBe('generate')
  })

  it('ignores draft categories when deciding registration/draw readiness', () => {
    const progress = deriveWizardProgress(
      baseInput({
        sportsCount: 1,
        categories: [
          { id: 1, status: 'open', format_type: 'single_elimination' },
          { id: 2, status: 'draft', format_type: 'single_elimination' },
        ],
        playersCount: 8,
        confirmedEntries: [{ category_id: 1 }, { category_id: 1 }],
      }),
    )
    expect(progress.completedSteps.has('registration')).toBe(true)
  })

  it('completes generate/bracket for auto-generate formats once every category has matches', () => {
    const progress = deriveWizardProgress(
      baseInput({
        sportsCount: 1,
        categories: [{ id: 1, status: 'open', format_type: 'single_elimination' }],
        playersCount: 4,
        confirmedEntries: [{ category_id: 1 }, { category_id: 1 }],
        matches: [{ category_id: 1, stage_id: 9 }],
      }),
    )
    expect(progress.completedSteps.has('generate')).toBe(true)
    expect(progress.completedSteps.has('bracket')).toBe(true)
    expect(progress.firstIncompleteStep).toBe('bracket')
    expect(progress.isComplete).toBe(true)
  })

  it('completes generate/bracket for a group->knockout category once its GROUP fixtures exist', () => {
    // prd/redesign/wizard-completion-and-post-generate-flow.md: finalizing the group standings and
    // promoting to the knockout are event-time actions - the wizard is "done" at group fixtures.
    const common = {
      sportsCount: 1,
      categories: [{ id: 1, status: 'open', format_type: 'group_stage_to_knockout' as const }],
      playersCount: 8,
      confirmedEntries: [{ category_id: 1 }, { category_id: 1 }],
      groupStageIds: [100],
    }

    const noFixtures = deriveWizardProgress(baseInput({ ...common, matches: [] }))
    expect(noFixtures.completedSteps.has('generate')).toBe(false)
    expect(noFixtures.firstIncompleteStep).toBe('generate')

    const groupFixtures = deriveWizardProgress(
      baseInput({ ...common, matches: [{ category_id: 1, stage_id: 100 }] }),
    )
    expect(groupFixtures.completedSteps.has('generate')).toBe(true)
    expect(groupFixtures.completedSteps.has('bracket')).toBe(true)
    expect(groupFixtures.isComplete).toBe(true)
    expect(groupFixtures.firstIncompleteStep).toBe('bracket')
  })

  it('does not count a group->knockout category done just because a knockout match exists without group fixtures', () => {
    // Defensive: a stray knockout-stage match (stage 200) is not a group-stage match, so it must
    // not satisfy the generate bar on its own.
    const progress = deriveWizardProgress(
      baseInput({
        sportsCount: 1,
        categories: [{ id: 1, status: 'open', format_type: 'group_stage_to_knockout' as const }],
        playersCount: 8,
        confirmedEntries: [{ category_id: 1 }, { category_id: 1 }],
        groupStageIds: [100],
        matches: [{ category_id: 1, stage_id: 200 }],
      }),
    )
    expect(progress.completedSteps.has('generate')).toBe(false)
  })
})
