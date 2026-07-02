# ROC GMS V2 - Vibe Coding Guide

Owner: Rusydani  
Project: `roc_gms_v2`  
Status: Draft v1  
Last updated: 2026-07-02

## 1. Purpose

This guide keeps Vibe Coding sessions controlled, resumable, and less likely to drift away from the product vision.

## 2. Before Starting a Session

Always ask the coding agent to read these files:

1. `prd/README.md`
2. `prd/implementation-plan.md`
3. `prd/decision-log.md`
4. `prd/session-handoff.md`

Then ask it to inspect:

- Repository structure.
- Git status.
- Existing package files.
- Existing Docker files.
- Latest changed files.

## 3. Prompt Pattern

Use this structure:

```text
Read prd/README.md, prd/implementation-plan.md, prd/decision-log.md, and prd/session-handoff.md first.

Goal:
[specific goal]

Scope:
[what should be changed]

Do not:
[what must be avoided]

Acceptance criteria:
[how we know it is done]

Before finishing:
Run relevant checks and update prd/session-handoff.md.
```

## 4. Good First Build Prompt

```text
Read prd/README.md, prd/implementation-plan.md, prd/decision-log.md, and prd/session-handoff.md first. Start Phase 0 for ROC GMS V2 using Next.js, Payload CMS, PostgreSQL, Redis, Mailpit, and Docker Compose. Keep English naming. Do not implement tournament features yet. Make the app runnable locally, add basic admin auth, add project README run instructions, and update prd/session-handoff.md when finished.
```

## 5. Bad Prompt Examples

Avoid broad prompts like:

```text
Build the whole GMS app.
```

Avoid mixing too many phases:

```text
Setup the project, make bracket, make live score, make article CMS, make email, and make all UI beautiful.
```

Avoid unclear design prompts:

```text
Make the admin good.
```

## 6. Better Prompt Examples

Phase-specific:

```text
Continue from prd/session-handoff.md. Implement Phase 1 only: Event, Sport, CompetitionCategory, Club, Player, Team, Roster, CompetitionEntry, Venue, and Court. Add demo seed for ROC Olympic 2026. Do not implement schedule or match logic yet. Update handoff when done.
```

Bug fix:

```text
Read the latest handoff first. Fix the schedule filter bug where category filtering does not update the public schedule list. Keep the change scoped. Add or update verification notes in prd/session-handoff.md.
```

UI refinement:

```text
Improve only the Match Officer mobile dashboard. Keep existing data model unchanged. Focus on readability, large tap targets, and quick access to start match, input score, live score, documentation, and notes. Verify mobile layout.
```

## 7. Session Discipline

Recommended rules:

- One phase or one feature per session.
- No major refactor unless the goal says so.
- Keep work runnable.
- Update handoff every session.
- Commit stable milestones.
- Use demo data to verify core flows.
- Keep UI work grounded in PRD flows.

## 8. Daily Limit or Session End Recovery

If the session ends suddenly:

1. Start the next session by reading the four PRD control files.
2. Inspect git status.
3. Inspect recent changed files.
4. Run the app or tests if possible.
5. Update `prd/session-handoff.md` if the previous session did not.
6. Continue from the smallest unfinished task.

## 9. Recommended Branch and Commit Style

Branch naming:

- `codex/phase-0-foundation`
- `codex/phase-1-event-structure`
- `codex/phase-2-schedule-foundation`

Commit style:

- `docs: add PRD control documents`
- `chore: scaffold app foundation`
- `feat: add event structure collections`
- `feat: add scheduling foundation`
- `feat: add match officer workspace`
- `fix: correct standing calculation`

## 10. Things to Protect

Do not accidentally remove or break:

- Public Coming Soon visibility rule.
- English-first internal naming.
- Flexible participant model.
- Optional roster logic.
- Match lifecycle statuses.
- Audit log requirements.
- Mobile-first public and match officer experience.
- Operational cockpit concept.

