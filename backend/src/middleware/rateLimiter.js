import rateLimit from 'express-rate-limit';

// General API protection rate limiter (applied globally or to vault access endpoints)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

// Key lookup rate limiter (brute-force protection on vault entry)
export const accessLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 vault entries per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many access attempts. Please slow down.'
  }
});

// In-memory store to track vault creations per IP (maximum 10 vaults per hour)
// This preserves privacy as it is never persisted to the database.
const creationTracker = new Map(); // ip -> Array of timestamps

/**
 * Checks and records vault creations per IP.
 * Enforces a maximum of 10 vault creations per hour per IP.
 *
 * @param {string} ip - The client's IP address
 * @returns {boolean} True if creation is allowed, false if limit exceeded
 */
export function limitVaultCreation(ip) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  let timestamps = creationTracker.get(ip) || [];

  // Filter out timestamps older than 1 hour
  timestamps = timestamps.filter(t => t > oneHourAgo);

  if (timestamps.length >= 10) {
    // Limit exceeded
    creationTracker.set(ip, timestamps); // Save cleaned up list
    return false;
  }

  // Record the new creation
  timestamps.push(now);
  creationTracker.set(ip, timestamps);
  return true;
}

// Periodically clean up the memory tracker to avoid leak-like growth
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  for (const [ip, timestamps] of creationTracker.entries()) {
    const active = timestamps.filter(t => t > oneHourAgo);
    if (active.length === 0) {
      creationTracker.delete(ip);
    } else {
      creationTracker.set(ip, active);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes
