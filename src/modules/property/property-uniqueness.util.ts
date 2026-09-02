/**
 * property_identifier is the only unique property field. Names, Expedia,
 * Booking and Agoda IDs may all be shared by several properties.
 */
export type PropertyUniqueFieldValues = {
  property_identifier?: string | null
}

type PropertyLookupClient = {
  property: {
    findFirst: (args: {
      where: Record<string, unknown>
    }) => Promise<{ id: string } | null>
  }
}

export function normalizePropertyIdentifier(
  value?: string | null
): string | undefined {
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed === '' ? undefined : trimmed
}

function hasStringValue(value: string | null | undefined): value is string {
  return value != null && String(value).trim() !== ''
}

async function findPropertyIdentifierConflict(
  prisma: PropertyLookupClient,
  propertyIdentifier: string,
  excludeId?: string
): Promise<string | null> {
  const excludeSelf = excludeId ? { id: { not: excludeId } } : {}
  const existing = await prisma.property.findFirst({
    where: {
      property_identifier: {
        equals: propertyIdentifier,
        mode: 'insensitive'
      },
      ...excludeSelf
    }
  })
  if (!existing) return null
  return `Another property already has the identifier: ${propertyIdentifier}`
}

export async function collectPropertyUniqueConflicts(
  prisma: PropertyLookupClient,
  fields: PropertyUniqueFieldValues,
  excludeId?: string
): Promise<string[]> {
  const errors: string[] = []

  if (hasStringValue(fields.property_identifier)) {
    const propertyIdentifier = fields.property_identifier.trim()
    const identifierConflict = await findPropertyIdentifierConflict(
      prisma,
      propertyIdentifier,
      excludeId
    )
    if (identifierConflict) errors.push(identifierConflict)
  }

  return errors
}

export function propertyIdentifierKey(value: string): string {
  return value.trim().toLowerCase()
}
