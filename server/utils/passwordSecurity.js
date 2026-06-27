import bcrypt from 'bcryptjs';

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

/**
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * @param {string} roomPassword
 * @returns {Promise<string|null>}
 */
export const hashRoomPassword = async (roomPassword) => {
  if (!roomPassword) return null;
  return await hashPassword(roomPassword);
};

/**
 * @param {string} inputPassword
 * @param {string|null} storedHash
 * @returns {Promise<boolean>}
 */
export const verifyRoomPassword = async (inputPassword, storedHash) => {
  if (!storedHash) return false;
  return await verifyPassword(inputPassword, storedHash);
};

export default {
  hashPassword,
  verifyPassword,
  hashRoomPassword,
  verifyRoomPassword
};