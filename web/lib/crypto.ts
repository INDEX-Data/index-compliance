// =============================================================================
// INDEX — AES-256-GCM Field-Level Encryption
// Encrypts sensitive client credentials at rest in the database.
// Storage format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import env from '@/lib/env'

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encoded: string): string {
  if (!encoded.startsWith(PREFIX)) {
    throw new Error('Invalid encrypted value: missing enc:v1: prefix')
  }
  const parts = encoded.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value: expected iv:tag:ciphertext')
  }
  const [ivHex, tagHex, ctHex] = parts
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ctHex, 'hex')

  if (iv.length !== IV_BYTES) throw new Error('Invalid IV length')
  if (authTag.length !== TAG_BYTES) throw new Error('Invalid auth tag length')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function decryptIfNeeded(value: string): string {
  return isEncrypted(value) ? decrypt(value) : value
}
