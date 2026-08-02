/**
 * Smoke-test POST /property/filter and GET /property/global-filter
 * for subportfolio + OTA priority/run-date fields.
 *
 * Usage (inside api container):
 *   node scripts/test-property-filters.js
 */
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const API = process.env.API_BASE || 'http://127.0.0.1:8080/api'

async function getToken() {
  const user = await prisma.user.findFirst({
    where: { is_verified: true },
    orderBy: { created_at: 'asc' },
    select: { id: true, email: true, user_role_id: true }
  })
  if (!user) throw new Error('No active user found in database')

  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set')

  return jwt.sign(
    { sub: user.id, email: user.email, role_id: user.user_role_id },
    secret,
    { expiresIn: '1h' }
  )
}

async function api(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function sampleValues() {
  const [
    subportfolio,
    expediaPriority,
    bookingPriority,
    agodaPriority,
    expediaRunDate,
    expediaRunDateDb,
    bookingRunDate,
    agodaRunDate
  ] = await Promise.all([
    prisma.subportfolio.findFirst({
      where: { properties: { some: {} } },
      select: { id: true, name: true }
    }),
    prisma.property.findFirst({
      where: { expedia_priority: { not: null } },
      select: { expedia_priority: true }
    }),
    prisma.property.findFirst({
      where: { booking_priority: { not: null } },
      select: { booking_priority: true }
    }),
    prisma.property.findFirst({
      where: { agoda_priority: { not: null } },
      select: { agoda_priority: true }
    }),
    prisma.property.findFirst({
      where: { expedia_run_date: { not: null } },
      select: { expedia_run_date: true }
    }),
    prisma.property.findFirst({
      where: { expedia_run_date_db: { not: null } },
      select: { expedia_run_date_db: true }
    }),
    prisma.property.findFirst({
      where: { booking_run_date: { not: null } },
      select: { booking_run_date: true }
    }),
    prisma.property.findFirst({
      where: { agoda_run_date: { not: null } },
      select: { agoda_run_date: true }
    })
  ])

  return {
    subportfolio_id: subportfolio?.id,
    subportfolio_name: subportfolio?.name,
    expedia_priority: expediaPriority?.expedia_priority,
    booking_priority: bookingPriority?.booking_priority,
    agoda_priority: agodaPriority?.agoda_priority,
    expedia_run_date: expediaRunDate?.expedia_run_date,
    expedia_run_date_db: expediaRunDateDb?.expedia_run_date_db,
    booking_run_date: bookingRunDate?.booking_run_date,
    agoda_run_date: agodaRunDate?.agoda_run_date
  }
}

async function countDirect(field, value) {
  if (!value) return 0
  if (field.endsWith('_priority')) {
    return prisma.property.count({
      where: {
        [field]: { equals: String(value), mode: 'insensitive' }
      }
    })
  }
  if (field === 'subportfolio_id') {
    return prisma.property.count({ where: { subportfolio_id: value } })
  }
  return prisma.property.count({ where: { [field]: value } })
}

async function testFilter(token, name, value) {
  const body = {
    filters: [{ name, in: [value] }],
    page: 1,
    limit: 10,
    masked: true
  }
  const { status, json } = await api('/property/filter', token, body)
  const apiCount = json?.metadata?.totalDocuments
  const directCount = await countDirect(name, value)
  const ok = status === 200 || status === 201
  const match = ok && apiCount === directCount
  return {
    field: name,
    value,
    httpStatus: status,
    apiCount,
    directCount,
    pass: ok && match,
    note: !value ? 'no sample data in DB' : match ? 'ok' : `mismatch api=${apiCount} db=${directCount}`
  }
}

;(async () => {
  const token = await getToken()
  const samples = await sampleValues()

  console.log('Sample values from DB:', JSON.stringify(samples, null, 2))

  const global = await api('/property/global-filter', token)
  const gf = global.json?.data ?? global.json
  const globalChecks = [
    ['subportfolio', Array.isArray(gf?.subportfolio) && gf.subportfolio.length > 0],
    ['expedia_priority', Array.isArray(gf?.expedia_priority)],
    ['booking_priority', Array.isArray(gf?.booking_priority)],
    ['agoda_priority', Array.isArray(gf?.agoda_priority)],
    ['expedia_run_date', Array.isArray(gf?.expedia_run_date)],
    ['expedia_run_date_db', Array.isArray(gf?.expedia_run_date_db)],
    ['booking_run_date', Array.isArray(gf?.booking_run_date)],
    ['agoda_run_date', Array.isArray(gf?.agoda_run_date)]
  ]

  console.log('\n--- GET /property/global-filter ---')
  console.log('HTTP', global.status)
  for (const [field, ok] of globalChecks) {
    const len = Array.isArray(gf?.[field]) ? gf[field].length : 'n/a'
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${field} (items: ${len})`)
  }

  const filterTests = [
    ['subportfolio_id', samples.subportfolio_id],
    ['expedia_priority', samples.expedia_priority],
    ['booking_priority', samples.booking_priority],
    ['agoda_priority', samples.agoda_priority],
    ['expedia_run_date', samples.expedia_run_date],
    ['expedia_run_date_db', samples.expedia_run_date_db],
    ['booking_run_date', samples.booking_run_date],
    ['agoda_run_date', samples.agoda_run_date]
  ]

  console.log('\n--- POST /property/filter ---')
  const results = []
  for (const [name, value] of filterTests) {
    if (!value) {
      results.push({ field: name, pass: null, note: 'skipped — no sample data' })
      console.log(`  SKIP ${name} — no sample data in DB`)
      continue
    }
    const r = await testFilter(token, name, value)
    results.push(r)
    console.log(
      `  ${r.pass ? 'PASS' : 'FAIL'} ${name}=${JSON.stringify(value)} api=${r.apiCount} db=${r.directCount} http=${r.httpStatus}`
    )
  }

  const failed = results.filter(r => r.pass === false)
  const passed = results.filter(r => r.pass === true)
  console.log('\nSummary:', `${passed.length} passed`, `${failed.length} failed`, `${results.filter(r => r.pass === null).length} skipped`)
  await prisma.$disconnect()
  process.exit(failed.length > 0 ? 1 : 0)
})().catch(err => {
  console.error(err)
  process.exit(1)
})
