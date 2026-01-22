/**
 * =============================================================================
 * Epsilon - Color Check Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service handles all color-related compliance checking including:
 * - Exact color matching
 * - Color distance calculation (Delta-E)
 * - Tolerance-based matching
 * - Closest brand color suggestions
 *
 * COLOR MATCHING ALGORITHM:
 * Uses Delta-E (CIE76) color difference formula which models human color
 * perception. A Delta-E of:
 * - 0: Exact match
 * - 1-2: Perceptible through close observation
 * - 2-10: Perceptible at a glance
 * - 10+: Colors are more similar than opposite
 */

import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// COLOR CONVERSION UTILITIES
// ---------------------------------------------------------------------------

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code (e.g., "#1A73E8")
 * @returns {Object} RGB values { r, g, b }
 */
export const hexToRgb = (hex) => {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, "");

  // Handle 3-character hex codes
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;

  const bigint = parseInt(fullHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

/**
 * Convert RGB to LAB color space (for Delta-E calculation)
 * @param {Object} rgb - RGB values { r, g, b }
 * @returns {Object} LAB values { l, a, b }
 */
export const rgbToLab = (rgb) => {
  // First convert RGB to XYZ
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  // Convert XYZ to LAB
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
};

/**
 * Calculate Delta-E (CIE76) color difference
 * @param {string} hex1 - First hex color
 * @param {string} hex2 - Second hex color
 * @returns {number} Delta-E value (0 = identical, higher = more different)
 */
export const calculateColorDifference = (hex1, hex2) => {
  try {
    const lab1 = rgbToLab(hexToRgb(hex1));
    const lab2 = rgbToLab(hexToRgb(hex2));

    const deltaL = lab1.l - lab2.l;
    const deltaA = lab1.a - lab2.a;
    const deltaB = lab1.b - lab2.b;

    return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
  } catch (error) {
    logger.error("Error calculating color difference:", error);
    return 100; // Return max difference on error
  }
};

/**
 * Normalize hex color to lowercase with # prefix
 * @param {string} hex - Hex color code
 * @returns {string} Normalized hex color
 */
export const normalizeHex = (hex) => {
  if (!hex) return null;
  const clean = hex.replace(/^#/, "").toLowerCase();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return `#${full}`;
};

// ---------------------------------------------------------------------------
// COLOR CHECKING SERVICE
// ---------------------------------------------------------------------------

/**
 * Check a single color against the brand palette
 *
 * @param {string} color - Hex color from the design
 * @param {Array} brandColors - Array of brand color objects with hex and tolerance
 * @returns {Object} Check result with match status and details
 */
export const checkColorCompliance = (color, brandColors) => {
  const normalizedColor = normalizeHex(color);

  if (!normalizedColor) {
    return {
      isCompliant: false,
      color: color,
      reason: "Invalid color format",
      suggestedFix: null,
    };
  }

  let bestMatch = null;
  let minDifference = Infinity;

  for (const brandColor of brandColors) {
    const normalizedBrandColor = normalizeHex(brandColor.hex);
    const tolerance = brandColor.tolerance || 10;

    // Check exact match first
    if (normalizedColor === normalizedBrandColor) {
      return {
        isCompliant: true,
        color: normalizedColor,
        matchedBrandColor: brandColor,
        difference: 0,
      };
    }

    // Calculate color difference
    const difference = calculateColorDifference(
      normalizedColor,
      normalizedBrandColor
    );

    // Check if within tolerance
    if (difference <= tolerance) {
      return {
        isCompliant: true,
        color: normalizedColor,
        matchedBrandColor: brandColor,
        difference: Math.round(difference * 100) / 100,
      };
    }

    // Track best match for suggestion
    if (difference < minDifference) {
      minDifference = difference;
      bestMatch = brandColor;
    }
  }

  // Color is not compliant
  return {
    isCompliant: false,
    color: normalizedColor,
    closestBrandColor: bestMatch,
    difference: Math.round(minDifference * 100) / 100,
    suggestedFix: bestMatch?.hex,
  };
};

/**
 * Check all colors in a design against brand guidelines
 *
 * @param {Array} designColors - Array of hex colors used in the design
 * @param {Array} brandColors - Array of brand color objects
 * @returns {Object} Full color compliance report
 */
export const checkAllColors = (designColors, brandColors) => {
  if (!designColors || designColors.length === 0) {
    return {
      score: 100,
      violations: [],
      compliantColors: [],
      message: "No colors to check",
    };
  }

  if (!brandColors || brandColors.length === 0) {
    return {
      score: 0,
      violations: [
        {
          type: "color",
          severity: "medium",
          description: "No brand colors defined in brand kit",
          affectedElement: null,
          suggestedFix: "Add colors to the brand kit",
        },
      ],
      compliantColors: [],
      message: "Brand kit has no colors defined",
    };
  }

  const results = [];
  const violations = [];
  const compliantColors = [];

  // Check each design color
  designColors.forEach((color) => {
    const result = checkColorCompliance(color, brandColors);
    results.push(result);

    if (result.isCompliant) {
      compliantColors.push({
        color: result.color,
        matchedTo:
          result.matchedBrandColor?.name || result.matchedBrandColor?.hex,
      });
    } else {
      violations.push({
        type: "color",
        severity: result.difference > 30 ? "high" : "medium",
        description: `Color ${result.color} is not in the approved brand palette`,
        affectedElement: result.color,
        suggestedFix: result.suggestedFix,
        autoFixable: true,
        details: {
          closestMatch: result.closestBrandColor?.hex,
          difference: result.difference,
        },
      });
    }
  });

  // Calculate score (percentage of compliant colors)
  const score = Math.round(
    (compliantColors.length / designColors.length) * 100
  );

  return {
    score,
    violations,
    compliantColors,
    totalChecked: designColors.length,
    message:
      violations.length === 0
        ? "All colors are brand-compliant"
        : `${violations.length} color(s) need attention`,
  };
};

/**
 * Get suggested color replacements for fixing violations
 *
 * @param {Array} violations - Array of color violations
 * @param {Array} brandColors - Array of brand colors
 * @returns {Array} Array of color fix suggestions
 */
export const getColorFixSuggestions = (violations, brandColors) => {
  return violations
    .filter((v) => v.type === "color" && v.autoFixable)
    .map((violation) => ({
      original: violation.affectedElement,
      replacement: violation.suggestedFix,
      reason: `Replace with closest brand color`,
    }));
};

// Export service object
export default {
  checkColorCompliance,
  checkAllColors,
  calculateColorDifference,
  getColorFixSuggestions,
  hexToRgb,
  normalizeHex,
};
