// =============================================================================
// INDEX ATLAS — AES-256-GCM helper (src-side mirror of web/lib/crypto.ts)
//
// The web app encrypts with web/lib/crypto.ts. Third-party token refresh runs in
// src (operations/cron), which must NOT import from web/. This is a byte-for-byte
// compatible mirror reading the SAME ENCRYPTION_KEY, so values encrypted on
// either side decrypt on the other. Format: enc:v1:<iv_hex>:<authTag_hex>:<ct_hex>
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes, hex-encoded)')
  }
  return Buffer.from(key, 'hex')
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
