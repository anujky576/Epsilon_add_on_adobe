/**
 * =============================================================================
 * Epsilon - Logging Utility
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Simple console-based logger with structured output. In production, this would
 * be replaced with a more robust logging solution (Winston, Pino, etc.), but
 * for hackathon purposes, this provides clear, readable logs.
 *
 * LOG LEVELS:
 * - info: General information about application flow
 * - warn: Warning conditions that should be investigated
 * - error: Error conditions that need attention
 * - debug: Detailed debugging information (only in development)
 */

/**
 * Format a log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log string
 */
const formatLog = (level, message) => {
  const timestamp = new Date().toISOString();
  const levelColors = {
    INFO: "\x1b[36m", // Cyan
    WARN: "\x1b[33m", // Yellow
    ERROR: "\x1b[31m", // Red
    DEBUG: "\x1b[35m", // Magenta
  };
  const reset = "\x1b[0m";
  const color = levelColors[level] || "";

  return `${color}[${timestamp}] [${level}]${reset} ${message}`;
};

/**
 * Logger object with standard log level methods
 */
export const logger = {
  /**
   * Log informational message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  info: (message, ...args) => {
    console.log(formatLog("INFO", message), ...args);
  },

  /**
   * Log warning message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  warn: (message, ...args) => {
    console.warn(formatLog("WARN", message), ...args);
  },

  /**
   * Log error message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  error: (message, ...args) => {
    console.error(formatLog("ERROR", message), ...args);
  },

  /**
   * Log debug message (only in development)
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatLog("DEBUG", message), ...args);
    }
  },

  /**
   * Log an object in a readable format
   * @param {string} label - Label for the object
   * @param {Object} obj - Object to log
   */
  object: (label, obj) => {
    console.log(formatLog("INFO", label));
    console.dir(obj, { depth: null, colors: true });
  },
};

export default logger;
