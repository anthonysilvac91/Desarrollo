import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

export function sha256hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function aesGcmEncrypt(value: string, keyMaterial: string): string {
  const key = createHash('sha256').update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function aesGcmDecrypt(value: string, keyMaterial: string): string {
  const parts = value.split('.');
  if (parts.length !== 3 || !parts.every(Boolean)) {
    throw new Error('Invalid encrypted value format');
  }
  const [ivB64, authTagB64, encryptedB64] = parts;
  const key = createHash('sha256').update(keyMaterial).digest();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isAesGcmEncrypted(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every(Boolean);
}
