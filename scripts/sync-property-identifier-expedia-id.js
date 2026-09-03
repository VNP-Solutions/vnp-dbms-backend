/**
 * Backfills property_identifier <-> expedia_id for properties that carry
 * exactly one of the two. Properties with both values, or with neither, are
 * left alone.
 *
 * property_identifier is String? and expedia_id is Int?, so the copy converts:
 *   expedia_id -> property_identifier   always possible
 *   property_identifier -> expedia_id   only when the identifier is a plain
 *                                       integer that fits in a 32-bit int
 *
 * Writes go through $runCommandRaw with a single $set so that updated_at
 * (@updatedAt) and every other field stay untouched.
 *
 * Usage:
 *   node -r dotenv/config scripts/sync-property-identifier-expedia-id.js
 *   node -r dotenv/config scripts/sync-property-identifier-expedia-id.js --apply
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const APPLY = process.argv.includes('--apply')
const SAMPLE_SIZE = 10
const INT32_MAX = 2147483647

const isBlankText = value =>
  value === null || value === undefined || String(value).trim() === ''

const isBlankNumber = value => value === null || value === undefined

async function main() {
  console.log(APPLY ? 'MODE: apply' : 'MODE: dry run (pass --apply to write)')

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      name: true,
      property_identifier: true,
      expedia_id: true
    }
  })

  // property_identifier is the unique key for a property, so a generated one
  // must not collide with an identifier that already exists.
  const takenIdentifiers = new Set(
    properties
      .filter(p => !isBlankText(p.property_identifier))
      .map(p => p.property_identifier.trim().toLowerCase())
  )

  const planned = []
  const skipped = { bothPresent: 0, bothMissing: 0 }
  const blocked = []

  for (const property of properties) {
    const hasIdentifier = !isBlankText(property.property_identifier)
    const hasExpediaId = !isBlankNumber(property.expedia_id)

    if (hasIdentifier && hasExpediaId) {
      skipped.bothPresent++
      continue
    }
    if (!hasIdentifier && !hasExpediaId) {
      skipped.bothMissing++
      continue
    }

    if (hasExpediaId) {
      const identifier = String(property.expedia_id)
      const key = identifier.toLowerCase()
      if (takenIdentifiers.has(key)) {
        blocked.push({
          id: property.id,
          name: property.name,
          reason: `another property already uses property_identifier "${identifier}"`
        })
        continue
      }
      takenIdentifiers.add(key)
      planned.push({
        id: property.id,
        name: property.name,
        field: 'property_identifier',
        value: identifier,
        from: `expedia_id=${property.expedia_id}`
      })
      continue
    }

    const identifier = property.property_identifier.trim()
    if (!/^\d+$/.test(identifier)) {
      blocked.push({
        id: property.id,
        name: property.name,
        reason: `property_identifier "${identifier}" is not a plain integer, cannot become expedia_id`
      })
      continue
    }
    const expediaId = Number(identifier)
    if (!Number.isSafeInteger(expediaId) || expediaId > INT32_MAX) {
      blocked.push({
        id: property.id,
        name: property.name,
        reason: `property_identifier "${identifier}" does not fit in a 32-bit int`
      })
      continue
    }
    planned.push({
      id: property.id,
      name: property.name,
      field: 'expedia_id',
      value: expediaId,
      from: `property_identifier="${identifier}"`
    })
  }

  const toIdentifier = planned.filter(p => p.field === 'property_identifier')
  const toExpediaId = planned.filter(p => p.field === 'expedia_id')

  console.log(`\nproperties scanned: ${properties.length}`)
  console.log(`  both values present, untouched: ${skipped.bothPresent}`)
  console.log(`  both values missing, untouched: ${skipped.bothMissing}`)
  console.log(`  expedia_id -> property_identifier: ${toIdentifier.length}`)
  console.log(`  property_identifier -> expedia_id: ${toExpediaId.length}`)
  console.log(`  cannot be copied: ${blocked.length}`)

  for (const [label, rows] of [
    ['expedia_id -> property_identifier', toIdentifier],
    ['property_identifier -> expedia_id', toExpediaId]
  ]) {
    if (rows.length === 0) continue
    console.log(`\n${label} (first ${Math.min(SAMPLE_SIZE, rows.length)}):`)
    for (const row of rows.slice(0, SAMPLE_SIZE)) {
      console.log(`  ${row.name} | ${row.from} -> ${row.field}=${row.value}`)
    }
  }

  if (blocked.length > 0) {
    console.log(`\nskipped, needs a manual decision (first ${Math.min(SAMPLE_SIZE, blocked.length)}):`)
    for (const row of blocked.slice(0, SAMPLE_SIZE)) {
      console.log(`  ${row.name}: ${row.reason}`)
    }
  }

  if (!APPLY) {
    console.log('\nDry run only, nothing was written.')
    return
  }

  if (planned.length === 0) {
    console.log('\nNothing to update.')
    return
  }

  console.log(`\nApplying ${planned.length} update(s)...`)
  let updated = 0
  let failed = 0

  for (const change of planned) {
    // $numberInt keeps expedia_id a BSON 32-bit int, which is what Prisma's
    // Int type expects; a bare JS number could land as a double.
    const value =
      change.field === 'expedia_id'
        ? { $numberInt: String(change.value) }
        : change.value

    try {
      const result = await prisma.$runCommandRaw({
        update: 'Property',
        updates: [
          {
            q: { _id: { $oid: change.id } },
            u: { $set: { [change.field]: value } },
            multi: false
          }
        ]
      })
      if (result && result.n === 1) updated++
      else {
        failed++
        console.error(`  no document matched for ${change.name} (${change.id})`)
      }
    } catch (error) {
      failed++
      console.error(`  failed for ${change.name} (${change.id}): ${error.message}`)
    }
  }

  console.log(`updated: ${updated}, failed: ${failed}`)

  // Reading the touched rows back through Prisma proves the stored BSON types
  // still match the schema, so the app will not choke on them later.
  const ids = planned.map(c => c.id)
  const verified = await prisma.property.findMany({
    where: { id: { in: ids } },
    select: { id: true, property_identifier: true, expedia_id: true }
  })
  const byId = new Map(verified.map(p => [p.id, p]))
  const mismatched = planned.filter(change => {
    const row = byId.get(change.id)
    if (!row) return true
    return String(row[change.field]) !== String(change.value)
  })
  console.log(
    `verified via Prisma: ${planned.length - mismatched.length}/${planned.length} rows read back with the expected value`
  )
  if (mismatched.length > 0) {
    console.error('rows that did not verify:', mismatched.map(m => m.id))
  }
}

main()
  .catch(error => {
    console.error('Script failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
