export type PropertyUniqueFieldValues = {
  name?: string | null
  property_identifier?: string | null
  expedia_id?: number | null
  booking_id?: number | null
  agoda_id?: number | null
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

function hasNumericValue(value: number | null | undefined): value is number {
  return value != null && !Number.isNaN(value)
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
  const excludeSelf = excludeId ? { id: { not: excludeId } } : {}

  // Property identifier is checked first — must be unique when present (case-insensitive).
  if (hasStringValue(fields.property_identifier)) {
    const propertyIdentifier = fields.property_identifier.trim()
    const identifierConflict = await findPropertyIdentifierConflict(
      prisma,
      propertyIdentifier,
      excludeId
    )
    if (identifierConflict) errors.push(identifierConflict)
  }

  if (hasStringValue(fields.name)) {
    const name = fields.name.trim()
    const existing = await prisma.property.findFirst({
      where: { name, ...excludeSelf }
    })
    if (existing) {
      errors.push(`Another property already has the name: ${name}`)
    }
  }

  if (hasNumericValue(fields.expedia_id)) {
    const existing = await prisma.property.findFirst({
      where: { expedia_id: fields.expedia_id, ...excludeSelf }
    })
    if (existing) {
      errors.push(
        `Another property already has the Expedia ID: ${fields.expedia_id}`
      )
    }
  }

  if (hasNumericValue(fields.booking_id)) {
    const existing = await prisma.property.findFirst({
      where: { booking_id: fields.booking_id, ...excludeSelf }
    })
    if (existing) {
      errors.push(
        `Another property already has the Booking ID: ${fields.booking_id}`
      )
    }
  }

  if (hasNumericValue(fields.agoda_id)) {
    const existing = await prisma.property.findFirst({
      where: { agoda_id: fields.agoda_id, ...excludeSelf }
    })
    if (existing) {
      errors.push(
        `Another property already has the Agoda ID: ${fields.agoda_id}`
      )
    }
  }

  return errors
}

export function propertyIdentifierKey(value: string): string {
  return value.trim().toLowerCase()
}
