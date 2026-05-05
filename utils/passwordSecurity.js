// Password Security Utilities
// NOTE: Firebase Auth handles password hashing automatically
// These utilities are for reference and other security needs

import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * HASHING: One-way cryptographic function
 * Use for: Passwords, API keys, tokens
 */

// ============================================
// PASSWORD HASHING (If not using Firebase)
// ============================================

/**
 * Hash a password with bcrypt (industry standard)
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password with salt
 */
export const hashPassword = async (password) => {
  const saltRounds = 12; // Higher = more secure but slower (10-12 recommended)
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;

  // Example:
  // Input:  "MyPassword123"
  // Output: "$2b$12$KIXxBV7f2ydT3hCJ8f5u4eF9LZxQQxGN9x8y7z6a5b4c3d2e1f0g1h"
  //         [algorithm][cost][salt][hash]
};

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored hash to compare against
 * @returns {Promise<boolean>} - True if password matches
 */
export const verifyPassword = async (password, hash) => {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
};

// ============================================
// SALTING: Adding random data before hashing
// ============================================

/**
 * Generate a cryptographically secure random salt
 * @param {number} length - Length of salt in bytes (default: 32)
 * @returns {string} - Hexadecimal salt string
 */
export const generateSalt = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');

  // Example output: "f3b8c9d2e1a4b7c6d9e2f5a8b1c4d7e0"
};

/**
 * Hash data with a custom salt (for API keys, tokens, etc.)
 * @param {string} data - Data to hash
 * @param {string} salt - Salt to use (or generate new one)
 * @returns {object} - Object with hash and salt
 */
export const hashWithSalt = (data, salt = null) => {
  if (!salt) {
    salt = generateSalt();
  }

  const hash = crypto
    .createHash('sha256')
    .update(data + salt)
    .digest('hex');

  return { hash, salt };
};

/**
 * Verify data against a hash and salt
 * @param {string} data - Data to verify
 * @param {string} hash - Stored hash
 * @param {string} salt - Stored salt
 * @returns {boolean} - True if data matches
 */
export const verifyWithSalt = (data, hash, salt) => {
  const newHash = crypto
    .createHash('sha256')
    .update(data + salt)
    .digest('hex');

  return newHash === hash;
};

// ============================================
// PRACTICAL USE CASES FOR YOUR PROJECT
// ============================================

/**
 * 1. API Key Hashing (for third-party integrations)
 */
export const createApiKey = () => {
  const apiKey = crypto.randomBytes(32).toString('hex');
  const { hash, salt } = hashWithSalt(apiKey);

  return {
    apiKey,        // Give this to user (only show once!)
    hash,          // Store in database
    salt           // Store in database
  };
};

/**
 * 2. Meeting Room Password Hashing
 * For private audio/video rooms
 */
export const hashRoomPassword = async (roomPassword) => {
  if (!roomPassword) return null;
  return await hashPassword(roomPassword);
};

export const verifyRoomPassword = async (inputPassword, storedHash) => {
  if (!storedHash) return true; // No password set
  return await verifyPassword(inputPassword, storedHash);
};

/**
 * 3. Secure Token Generation (for password reset, email verification)
 */
export const generateSecureToken = () => {
  // Generate cryptographically secure random token
  return crypto.randomBytes(32).toString('hex');
};

/**
 * 4. Hash Sensitive Data (like credit card last 4 digits)
 */
export const hashSensitiveData = (data) => {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
};

// ============================================
// SECURITY BEST PRACTICES
// ============================================

/**
 * Constant-time comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings match
 */
export const secureCompare = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  );
};

/**
 * Generate a password reset token with expiry
 */
export const generatePasswordResetToken = () => {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 1); // Expire in 1 hour

  const { hash, salt } = hashWithSalt(token);

  return {
    token,      // Send to user via email
    hash,       // Store in database
    salt,       // Store in database
    expires     // Store in database
  };
};

/**
 * Verify password reset token
 */
export const verifyPasswordResetToken = (inputToken, storedHash, storedSalt, expiryDate) => {
  // Check if token expired
  if (new Date() > new Date(expiryDate)) {
    return { valid: false, reason: 'expired' };
  }

  // Verify token
  const isValid = verifyWithSalt(inputToken, storedHash, storedSalt);

  return { valid: isValid, reason: isValid ? null : 'invalid' };
};

// ============================================
// EXPORT ALL UTILITIES
// ============================================

export default {
  // Password functions
  hashPassword,
  verifyPassword,

  // Salt functions
  generateSalt,
  hashWithSalt,
  verifyWithSalt,

  // Practical use cases
  createApiKey,
  hashRoomPassword,
  verifyRoomPassword,
  generateSecureToken,
  hashSensitiveData,

  // Security utilities
  secureCompare,
  generatePasswordResetToken,
  verifyPasswordResetToken
};
