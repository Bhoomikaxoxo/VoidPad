import crypto from 'crypto';

/**
 * Deterministically hashes a vault key using a static pepper secret.
 * This allows sub-millisecond, O(1) query lookups in the database using the unique keyHash field.
 *
 * @param {string} key - The plaintext key entered by the user (must be 6+ characters)
 * @returns {Promise<string>} The deterministic HMAC-SHA256 hash of the key
 */
export async function hashKey(key) {
  const secret = process.env.KEY_PEPPER_SECRET || 'voidpad_static_pepper_secret_2026';
  return crypto.createHmac('sha256', secret).update(key).digest('hex');
}

