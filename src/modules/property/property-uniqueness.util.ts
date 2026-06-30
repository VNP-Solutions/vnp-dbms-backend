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

function hasStringValue(value: string | null | undefined): value is string {
  return value != null && String(value).trim() !== ''
}

function hasNumericValue(value: number | null | undefined): value is number {
  return value != null && !Number.isNaN(value)
}

export async function collectPropertyUniqueConflicts(
  prisma: PropertyLookupClient,
  fields: PropertyUniqueFieldValues,
  excludeId?: string
): Promise<string[]> {
  const errors: string[] = []
  const excludeSelf = excludeId ? { id: { not: excludeId } } : {}

  if (hasStringValue(fields.name)) {
    const name = fields.name.trim()
    const existing = await prisma.property.findFirst({
      where: { name, ...excludeSelf }
    })
    if (existing) {
      errors.push(`Another property already has the name: ${name}`)
    }
  }

  if (hasStringValue(fields.property_identifier)) {
    const propertyIdentifier = fields.property_identifier.trim()
    const existing = await prisma.property.findFirst({
      where: { property_identifier: propertyIdentifier, ...excludeSelf }
    })
    if (existing) {
      errors.push(
        `Another property already has the identifier: ${propertyIdentifier}`
      )
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
