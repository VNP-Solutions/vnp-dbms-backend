import { PrismaClient } from '@prisma/client'
import { PropertyRepository } from './src/modules/property/property.repository'
import { PropertyService } from './src/modules/property/property.service'
const prisma = new PrismaClient()
const repo: any = Object.create(PropertyRepository.prototype); repo.prisma = prisma
const svc: any = Object.create(PropertyService.prototype)
const build = (filters: any[]) => svc.buildPropertyFilterQuery({ filters }, 'all')

// Independent reference order (does not reuse the repository helpers)
const ref = async (where: any, keys: Array<[(r: any) => any, 'asc' | 'desc']>) => {
  const safe = await repo.withValidPortfolioFilter(where)
  const rows = await prisma.property.findMany({ where: safe, select: { id: true, portfolio: { select: { name: true } },
    credentials: { orderBy: { created_at: 'asc' }, take: 1, select: { expediaUsername: true, bookingUsername: true } } } })
  const cmp = (a: any, b: any) => (a == null && b == null) ? 0 : a == null ? -1 : b == null ? 1 : (a < b ? -1 : a > b ? 1 : 0)
  return rows.sort((x, y) => { for (const [f, d] of keys) { const c = cmp(f(x), f(y)); if (c) return d === 'asc' ? c : -c } return 0 })
}
const exp = (r: any) => r.credentials[0]?.expediaUsername
const bkg = (r: any) => r.credentials[0]?.bookingUsername
const pf = (r: any) => r.portfolio?.name
const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])
;(async () => {
  // 1. user_name_expedia asc, pages 1-3 + full
  let { where, orderBy } = build([{ name: 'user_name_expedia', sort_by: 'asc', in: [] }])
  console.log('orderBy built:', JSON.stringify(orderBy))
  let expected = await ref(where, [[exp, 'asc']])
  let t = Date.now(); const all = await repo.findAll({ where, orderBy }); const ms = Date.now() - t
  console.log(`asc  full list: ${all.length} rows in ${ms}ms, order matches reference: ${same(all.map((r: any) => r.id), expected.map(r => r.id))}`)
  // values compared, since ties can legitimately swap
  const valuesMatch = (rows: any[], refRows: any[], f: (r: any) => any) => same(rows.map(r => String(f(r))), refRows.map(r => String(f(r))))
  for (const [skip, take] of [[0, 10], [10, 10], [4050, 10]]) {
    const page = await repo.findAll({ where, orderBy, skip, take })
    const refPage = expected.slice(skip, skip + take)
    console.log(`asc  page skip=${skip} take=${take}: ${page.length} rows, usernames match reference: ${valuesMatch(page, refPage, exp)} → ${page.slice(0, 4).map((r: any) => JSON.stringify(exp(r) ?? null)).join(', ')}`)
  }
  const firstNonNull = expected.findIndex(r => exp(r) != null)
  console.log(`asc  empties first: ${firstNonNull} properties without an Expedia username precede the first one with a username`)
  // 2. desc: empties last
  ;({ where, orderBy } = build([{ name: 'user_name_expedia', sort_by: 'desc', in: [] }]))
  expected = await ref(where, [[exp, 'desc']])
  const d1 = await repo.findAll({ where, orderBy, skip: 0, take: 5 })
  const dl = await repo.findAll({ where, orderBy, skip: expected.length - 3, take: 5 })
  console.log(`desc first 5 match: ${valuesMatch(d1, expected.slice(0, 5), exp)} → ${d1.map((r: any) => JSON.stringify(exp(r) ?? null)).join(', ')}`)
  console.log(`desc last page (empties last): ${dl.map((r: any) => JSON.stringify(exp(r) ?? null)).join(', ')}`)
  // 3. multi-key: portfolio name asc, then booking username desc
  ;({ where, orderBy } = build([{ name: 'portfolio_id', sort_by: 'asc', in: [] }, { name: 'user_name_booking', sort_by: 'desc', in: [] }]))
  expected = await ref(where, [[pf, 'asc'], [bkg, 'desc']])
  const multi = await repo.findAll({ where, orderBy })
  console.log(`multi [portfolio asc, booking username desc]: (portfolio,username) sequence matches reference: ${same(multi.map((r: any) => `${pf(r)}|${bkg(r)}`), expected.map(r => `${pf(r)}|${bkg(r)}`))}`)
  // 4. combined with a filter
  const sample = await prisma.property.findFirst({ where: { credentials: { some: { expediaUsername: { not: null } } } }, select: { portfolio_id: true } })
  ;({ where, orderBy } = build([{ name: 'portfolio_id', in: [sample!.portfolio_id] }, { name: 'user_name_expedia', sort_by: 'asc', in: [] }]))
  expected = await ref(where, [[exp, 'asc']])
  const filtered = await repo.findAll({ where, orderBy })
  const cnt = await repo.count(where)
  console.log(`filtered portfolio + username sort: rows=${filtered.length} count()=${cnt} match: ${valuesMatch(filtered, expected, exp)}`)
  // 5. findIds uses the same order
  ;({ where, orderBy } = build([{ name: 'user_name_expedia', sort_by: 'asc', in: [] }]))
  const ids = await repo.findIds(where, orderBy); const listIds = (await repo.findAll({ where, orderBy })).map((r: any) => r.id)
  console.log(`findIds order equals findAll order: ${same(ids, listIds)}`)
  // 6. non-credential sort still goes to Prisma unchanged
  ;({ where, orderBy } = build([{ name: 'portfolio_id', sort_by: 'desc', in: [] }]))
  const p = await repo.findAll({ where, orderBy, skip: 0, take: 3 })
  console.log(`portfolio desc (Prisma path): ${p.map((r: any) => JSON.stringify(r.portfolio?.name)).join(', ')}`)
  await prisma.$disconnect()
})().catch(async e => { console.error('ERR', e); await prisma.$disconnect(); process.exit(1) })
