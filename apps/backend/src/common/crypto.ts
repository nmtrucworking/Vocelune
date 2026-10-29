import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { config } from './config';

function key(): Buffer {
  if (config.EMAIL_ENCRYPTION_KEY) {
    return Buffer.from(config.EMAIL_ENCRYPTION_KEY, 'hex');
  }
  // Safe deterministic fallback derived from DATABASE_URL if user hasn't set EMAIL_ENCRYPTION_KEY
  return createHash('sha256').update((config.DATABASE_URL || 'vocelune-default-key') + ':email-encryption-fallback').digest();
}
export function encryptEmail(text: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptEmail(text: string) {
  const bytes = Buffer.from(text, 'base64'), decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
