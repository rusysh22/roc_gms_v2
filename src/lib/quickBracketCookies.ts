// Shared across quickBracketActions.ts (sets it), the result page (reads it to decide CTA copy),
// and claimQuickBracketAction.ts (reads it to authorize a claim) - centralized so a typo in one
// spot can't silently desync from the other two.
export const QUICK_BRACKET_OWNER_COOKIE = 'quick_bracket_owner'
