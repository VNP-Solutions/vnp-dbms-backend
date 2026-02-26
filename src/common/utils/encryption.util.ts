import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 10
  private static readonly ALGORITHM = 'aes-256-cbc'
  private static readonly IV_LENGTH = 16

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  static encrypt(text: string, secret: string): string {
    const key = crypto.scryptSync(secret, 'salt', 32)
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
  }

  static decrypt(encryptedText: string, secret: string): string {
    const parts = encryptedText.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]

    const key = crypto.scryptSync(secret, 'salt', 32)
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Derive the encryption key from a secret.
   * Call this once and reuse the key for multiple decryptions.
   * This avoids the expensive scryptSync call for each decryption.
   */
  static deriveKey(secret: string): Buffer {
    return crypto.scryptSync(secret, 'salt', 32)
  }

  /**
   * Decrypt using a pre-derived key (much faster for bulk operations)
   */
  static decryptWithKey(encryptedText: string, key: Buffer): string {
    const parts = encryptedText.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  static generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  static generateTempPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''

    password += chars.charAt(Math.floor(Math.random() * 26))
    password += chars.charAt(26 + Math.floor(Math.random() * 26))
    password += chars.charAt(52 + Math.floor(Math.random() * 10))
    password += chars.charAt(62 + Math.floor(Math.random() * 8))

    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }
}
