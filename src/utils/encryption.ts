/**
 * PHASE 5: DATA ENCRYPTION UTILITIES
 * 
 * Implements AES-256-GCM encryption for sensitive data:
 * - GSTIN, Phone numbers, Bank details
 * - Aadhaar/PAN numbers
 * - Tax documents
 * - Invoice files
 * 
 * SPECIFICATIONS:
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key Size: 256 bits (32 bytes)
 * - IV Size: 96 bits (12 bytes) - random for each operation
 * - Auth Tag Size: 128 bits (16 bytes)
 * 
 * SECURITY NOTES:
 * - Generate unique IV for EVERY encryption operation
 * - Store IV alongside ciphertext (IV doesn't need to be secret)
 * - Never reuse IV with same key
 * - Encryption key must be stored securely in .env (ENCRYPTION_SECRET)
 * - Decryption must happen only on backend (never send key to frontend)
 */

import crypto from 'crypto';

// Load encryption secret from environment
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';

if (!ENCRYPTION_SECRET) {
  console.warn('⚠️  WARNING: ENCRYPTION_SECRET not set. Encryption will fail at runtime.');
}

/**
 * Convert base64 string to Buffer
 */
function base64ToBuffer(base64String: string): Buffer {
  return Buffer.from(base64String, 'base64');
}

/**
 * Convert Buffer to base64 string
 */
function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Validate encryption secret
 * Must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET not configured in environment variables');
  }

  // If secret is 64 chars (hex), convert to buffer
  // If secret is 32 chars (base64), convert to buffer
  // Otherwise hash it to 256 bits
  let key: Buffer;

  if (ENCRYPTION_SECRET.length === 64) {
    // Assume hex encoding
    key = Buffer.from(ENCRYPTION_SECRET, 'hex');
  } else if (ENCRYPTION_SECRET.length === 44) {
    // Assume base64 encoding (32 bytes = 44 base64 chars with padding)
    key = Buffer.from(ENCRYPTION_SECRET, 'base64');
  } else {
    // Hash the secret to get 256 bits
    key = crypto
      .createHash('sha256')
      .update(ENCRYPTION_SECRET)
      .digest();
  }

  if (key.length !== 32) {
    throw new Error(
      `Invalid encryption key size: ${key.length} bytes. Expected 32 bytes (256 bits).`
    );
  }

  return key;
}

/**
 * ENCRYPT function with AES-256-GCM
 * 
 * @param plaintext - Data to encrypt
 * @returns {iv, ciphertext} - Both as base64 strings
 */
export function encrypt(plaintext: string): { iv: string; ciphertext: string } {
  try {
    const key = getEncryptionKey();
    
    // Generate random 96-bit IV (12 bytes) - must be different for each encryption
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt data
    let ciphertext = cipher.update(plaintext, 'utf-8', 'hex');
    ciphertext += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine ciphertext + auth tag (auth tag is essential for decryption)
    const encryptedData = ciphertext + authTag.toString('hex');

    return {
      iv: bufferToBase64(iv),
      ciphertext: encryptedData
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error(`Encryption failed: ${(error as Error).message}`);
  }
}

/**
 * DECRYPT function with AES-256-GCM
 * 
 * @param ciphertext - Encrypted data with auth tag appended (hex string)
 * @param iv - Base64 encoded initialization vector
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string, iv: string): string {
  try {
    const key = getEncryptionKey();
    const ivBuffer = base64ToBuffer(iv);
    
    // Extract auth tag (last 32 hex chars = 16 bytes)
    const authTagStart = ciphertext.length - 32;
    const encryptedHex = ciphertext.substring(0, authTagStart);
    const authTagHex = ciphertext.substring(authTagStart);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    
    // Set auth tag for verification
    const authTag = Buffer.from(authTagHex, 'hex');
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let plaintext = decipher.update(encryptedHex, 'hex', 'utf-8');
    plaintext += decipher.final('utf-8');

    return plaintext;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error(`Decryption failed: ${(error as Error).message}`);
  }
}

/**
 * Encrypt object to JSON, return base64 string
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T
): { iv: string; ciphertext: string } {
  const jsonString = JSON.stringify(obj);
  return encrypt(jsonString);
}

/**
 * Decrypt and parse JSON object
 */
export function decryptObject<T extends Record<string, any>>(
  ciphertext: string,
  iv: string
): T {
  const plaintext = decrypt(ciphertext, iv);
  return JSON.parse(plaintext) as T;
}

/**
 * Utility: Generate a secure ENCRYPTION_SECRET for .env
 * Run once and store the result in ENCRYPTION_SECRET environment variable
 */
export function generateEncryptionSecret(): string {
  // Generate 32 random bytes and encode as base64
  const secret = crypto.randomBytes(32).toString('base64');
  return secret;
}

/**
 * Hash a string (for non-reversible encryption, e.g., for verification)
 */
export function hashString(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');
}

/**
 * Encrypt a buffer with AES-256-GCM
 * @param buffer - File buffer to encrypt
 * @returns {iv, ciphertext} - IV and ciphertext as base64 strings
 */
export function encryptBuffer(buffer: Buffer): { iv: string; ciphertext: string } {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Append the 16-byte auth tag to the ciphertext buffer
    const encryptedBuffer = Buffer.concat([ciphertext, authTag]);

    return {
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(encryptedBuffer)
    };
  } catch (error) {
    console.error('Buffer encryption failed:', error);
    throw new Error(`Buffer encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypt a buffer with AES-256-GCM
 * @param ciphertextBase64 - Encrypted buffer with auth tag appended as base64 string
 * @param iv - Base64 encoded initialization vector
 * @returns Decrypted Buffer
 */
export function decryptBuffer(ciphertextBase64: string, iv: string): Buffer {
  try {
    const key = getEncryptionKey();
    const ivBuffer = base64ToBuffer(iv);
    const encryptedBuffer = base64ToBuffer(ciphertextBase64);
    
    // Auth tag is the last 16 bytes (128 bits)
    const authTagStart = encryptedBuffer.length - 16;
    const ciphertext = encryptedBuffer.subarray(0, authTagStart);
    const authTag = encryptedBuffer.subarray(authTagStart);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    
    return decrypted;
  } catch (error) {
    console.error('Buffer decryption failed:', error);
    throw new Error(`Buffer decryption failed: ${(error as Error).message}`);
  }
}

export default {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  generateEncryptionSecret,
  hashString,
  encryptBuffer,
  decryptBuffer
};
