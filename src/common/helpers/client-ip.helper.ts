import { Request } from 'express'

function getHeader(req: Request, ...keys: string[]): string | undefined {
  const wanted = keys.map((k) => k.toLowerCase())

  for (const key of wanted) {
    const value = req.headers[key]
    const normalized = Array.isArray(value) ? value[0]?.trim() : value?.trim()
    if (normalized) return normalized
  }

  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const key = req.rawHeaders[i]?.toLowerCase()
    if (!key || !wanted.includes(key)) continue

    const value = req.rawHeaders[i + 1]?.trim()
    if (value) return value
  }

  return undefined
}

function normalizeIp(ip: string): string {
  return ip.trim().replace(/^::ffff:/, '')
}

/** True for RFC1918, loopback, link-local, and other non-routable addresses. */
export function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = normalizeIp(ip)

  if (normalized.includes(':')) {
    const lower = normalized.toLowerCase()
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')
  }

  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true
  }

  const [a, b] = parts

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

function getForwardedIp(req: Request): string | undefined {
  return getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim()
}

/** Resolve the caller IP from trusted proxy headers or the socket. */
export function resolveClientIp(req: Request): string | undefined {
  const ip =
    getHeader(
      req,
      'ip-address',
      'x-client-ip',
      'x-real-ip',
      'true-client-ip',
      'cf-connecting-ip'
    ) ||
    getForwardedIp(req) ||
    req.ip ||
    req.socket?.remoteAddress

  return ip ? normalizeIp(ip) : undefined
}
