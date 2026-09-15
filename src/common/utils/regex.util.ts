/**
 * Escapes RegExp metacharacters so the value matches literally.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Case-insensitive exact-match filter for a Prisma string field.
 *
 * Use this instead of `{ equals: value, mode: 'insensitive' }`. On MongoDB,
 * Prisma runs that as `$regexMatch: { regex: "^<value>$", options: "i" }`
 * without escaping the value, so a name like "Valor Hospitality (Dubai)" is
 * read as a regex group and never matches itself — find-or-create lookups then
 * miss the existing record and create a duplicate.
 */
export function insensitiveEquals(value: string) {
  return { equals: escapeRegex(value), mode: 'insensitive' as const }
}
