import bcrypt from 'bcryptjs';

/**
 * Deterministically hashes a vault key using a static salt (pepper).
 * This allows O(1) query lookups in the database using the unique keyHash field.
 *
 * @param {string} key - The plaintext key entered by the user (must be 6+ characters)
 * @returns {Promise<string>} The deterministic hash of the key
 */
export async function hashKey(key) {
  // Use the salt from environment variables or fallback to a default development salt
  const salt = process.env.BCRYPT_SALT || '$2a$10$voidpadstaticpeppersalt';
  return bcrypt.hash(key, salt);
}
