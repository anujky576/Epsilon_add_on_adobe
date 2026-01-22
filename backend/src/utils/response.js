/**
 * =============================================================================
 * Epsilon - Standardized API Response Utilities
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * All API responses follow a consistent structure for predictable client-side
 * handling. This is especially important for the Adobe Express Add-on which
 * expects deterministic response formats.
 *
 * RESPONSE FORMAT:
 * {
 *   success: boolean,
 *   data: object | null,
 *   message: string
 * }
 */

/**
 * Creates a successful response object
 *
 * @param {Object} data - The response data
 * @param {string} [message='Success'] - Optional success message
 * @returns {Object} Formatted success response
 *
 * @example
 * res.json(successResponse({ brandKit: savedKit }, 'Brand kit created'));
 */
export const successResponse = (data, message = "Success") => {
  return {
    success: true,
    data,
    message,
  };
};

/**
 * Creates an error response object
 *
 * @param {string} message - The error message
 * @param {Object} [data=null] - Optional error details
 * @returns {Object} Formatted error response
 *
 * @example
 * res.status(400).json(errorResponse('Brand kit not found'));
 */
export const errorResponse = (message, data = null) => {
  return {
    success: false,
    data,
    message,
  };
};

/**
 * Creates a validation error response with field-level details
 *
 * @param {Object} errors - Field-level validation errors
 * @returns {Object} Formatted validation error response
 *
 * @example
 * res.status(400).json(validationErrorResponse({
 *   colors: 'At least one color is required',
 *   name: 'Name must be between 3 and 50 characters'
 * }));
 */
export const validationErrorResponse = (errors) => {
  return {
    success: false,
    data: { errors },
    message: "Validation failed",
  };
};

/**
 * Creates a paginated response object
 *
 * @param {Array} items - The array of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Formatted paginated response
 */
export const paginatedResponse = (items, page, limit, total) => {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    },
    message: "Success",
  };
};
