/**
 * A value a user typed to mean "no value": N/A in any casing, with either
 * slash and any stray spaces — "N/A", " n/a ", "N\A", "n / A".
 */
const NOT_APPLICABLE_PATTERN = /^\s*n\s*[/\\]\s*a\s*$/i

export function isNotApplicableToken(value: unknown): boolean {
  return typeof value === 'string' && NOT_APPLICABLE_PATTERN.test(value)
}
