// Socket.IO Client Configuration
// Supports both single-server and load-balanced environments

/**
 * Get the Socket.IO server URL from environment variables
 * Falls back to localhost:3001 for development
 */
export const getSocketServerUrl = () => {
  return import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';
};

/**
 * Default Socket.IO client options
 * Configured for reliability and reconnection
 */
export const socketOptions = {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ['websocket', 'polling'],
  upgrade: true,
  forceNew: false,
  // Enable sticky sessions for load balanced environments
  // This ensures reconnections go to the same server instance
  withCredentials: true
};

/**
 * Create socket connection configuration
 * @param {Object} additionalOptions - Additional socket.io options to merge
 * @returns {Object} Complete socket configuration
 */
export const createSocketConfig = (additionalOptions = {}) => {
  return {
    url: getSocketServerUrl(),
    options: {
      ...socketOptions,
      ...additionalOptions
    }
  };
};

// Export default configuration
export default {
  url: getSocketServerUrl(),
  options: socketOptions
};
