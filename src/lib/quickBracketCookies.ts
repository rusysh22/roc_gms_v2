// Shared across quickBracketActions.ts (sets it), the result page (reads it to decide CTA copy),
// and claimQuickBracketAction.ts (reads it to authorize a claim).
//
// Scoped per-slug (`qb_owner_<slug>`) rather than one shared cookie name - a visitor who creates
// more than one guest bracket in the same browser (easy to do: the whole point of the form is fast
// iteration) would otherwise have each new bracket's create() overwrite the previous bracket's
// ownership cookie, silently locking them out of claiming anything but the most recent one. Found
// via an end-to-end Playwright run that created 4 brackets in one session and then couldn't claim
// the first (see prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md's Phase 2 notes).
export const quickBracketOwnerCookieName = (slug: string) => `qb_owner_${slug}`
