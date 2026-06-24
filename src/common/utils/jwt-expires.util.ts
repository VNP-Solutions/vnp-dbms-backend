/** Converts JWT expiresIn strings (e.g. 7d, 12h, 30m) to milliseconds for cookie maxAge. */
export function jwtExpiresInToMs(expiresIn: string): number {
  const trimmed = expiresIn.trim()
  const match = /^(\d+)([smhd])$/i.exec(trimmed)
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000
  }

  const amount = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()

  switch (unit) {
    case 's':
      return amount * 1000
    case 'm':
      return amount * 60 * 1000
    case 'h':
      return amount * 60 * 60 * 1000
    case 'd':
      return amount * 24 * 60 * 60 * 1000
    default:
      return amount * 1000
  }
}
