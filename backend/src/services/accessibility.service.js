/**
 * =============================================================================
 * Epsilon - Accessibility Check Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service handles WCAG accessibility compliance checking including:
 * - Color contrast ratio validation
 * - Text size accessibility
 * - Alt text presence for images
 * - Touch target sizing (for interactive elements)
 *
 * WCAG GUIDELINES:
 * - Level AA minimum contrast: 4.5:1 for normal text, 3:1 for large text
 * - Level AAA contrast: 7:1 for normal text, 4.5:1 for large text
 * - Large text: 18pt (24px) or 14pt (18.66px) bold
 */

import { logger } from "../utils/logger.js";
import { hexToRgb } from "./colorCheck.service.js";

// ---------------------------------------------------------------------------
// CONTRAST CALCULATION
// ---------------------------------------------------------------------------

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.0 formula
 * @param {Object} rgb - RGB values { r, g, b }
 * @returns {number} Relative luminance (0-1)
 */
export const calculateLuminance = (rgb) => {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Calculate contrast ratio between two colors
 * Based on WCAG 2.0 formula: (L1 + 0.05) / (L2 + 0.05)
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @returns {number} Contrast ratio (1-21)
 */
export const calculateContrastRatio = (color1, color2) => {
  try {
    const lum1 = calculateLuminance(hexToRgb(color1));
    const lum2 = calculateLuminance(hexToRgb(color2));

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  } catch (error) {
    logger.error("Error calculating contrast ratio:", error);
    return 1; // Return minimum ratio on error
  }
};

/**
 * Check if contrast ratio meets WCAG requirements
 * @param {number} ratio - Calculated contrast ratio
 * @param {boolean} isLargeText - Whether the text is large (24px+ or 18.66px+ bold)
 * @param {string} level - WCAG level ('AA' or 'AAA')
 * @returns {Object} Compliance result
 */
export const checkContrastCompliance = (
  ratio,
  isLargeText = false,
  level = "AA"
) => {
  const requirements = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };

  const required = isLargeText
    ? requirements[level].large
    : requirements[level].normal;

  return {
    passes: ratio >= required,
    ratio,
    required,
    level,
    isLargeText,
    margin: Math.round((ratio - required) * 100) / 100,
  };
};

// ---------------------------------------------------------------------------
// ACCESSIBILITY CHECKING SERVICE
// ---------------------------------------------------------------------------

/**
 * Check text element accessibility
 *
 * @param {Object} textElement - Text element with color, fontSize, and potentially backgroundColor
 * @param {string} backgroundColor - Default background color
 * @param {Object} accessibilityRules - Brand kit accessibility rules
 * @returns {Object} Accessibility check result
 */
export const checkTextAccessibility = (
  textElement,
  backgroundColor,
  accessibilityRules
) => {
  const violations = [];
  const details = {};

  const textColor = textElement.color || "#000000";
  const bgColor = textElement.backgroundColor || backgroundColor || "#FFFFFF";
  const fontSize = textElement.fontSize || 16;
  const isBold = textElement.isBold || false;

  // Determine if text is "large" per WCAG
  // Large text: 18pt (24px) regular or 14pt (18.66px) bold
  const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
  details.isLargeText = isLargeText;

  // Calculate contrast
  const contrastRatio = calculateContrastRatio(textColor, bgColor);
  details.contrastRatio = contrastRatio;

  // Check against minimum requirement
  const minRequired = accessibilityRules?.minContrastRatio || 4.5;
  const largeTextMin = accessibilityRules?.largeTextMinContrast || 3;
  const required = isLargeText ? largeTextMin : minRequired;

  if (contrastRatio < required) {
    violations.push({
      type: "accessibility",
      severity: contrastRatio < required * 0.7 ? "high" : "medium",
      description: `Text contrast ratio (${contrastRatio}:1) is below WCAG ${
        isLargeText ? "large text" : "normal text"
      } requirement (${required}:1)`,
      affectedElement: {
        text: textElement.text?.substring(0, 50),
        textColor,
        backgroundColor: bgColor,
        fontSize,
      },
      suggestedFix: `Increase contrast by using darker text or lighter background. Required: ${required}:1`,
      autoFixable: false,
    });
  }

  // Check minimum font size
  const minFontSize = 12;
  if (fontSize < minFontSize) {
    violations.push({
      type: "accessibility",
      severity: "medium",
      description: `Font size (${fontSize}px) may be too small for comfortable reading`,
      affectedElement: {
        text: textElement.text?.substring(0, 50),
        fontSize,
      },
      suggestedFix: `Increase font size to at least ${minFontSize}px`,
      autoFixable: true,
    });
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    details,
    contrastRatio,
    message:
      violations.length === 0
        ? "Text meets accessibility requirements"
        : `${violations.length} accessibility issue(s) found`,
  };
};

/**
 * Check image accessibility (alt text)
 *
 * @param {Array} images - Array of image elements
 * @param {Object} accessibilityRules - Brand kit accessibility rules
 * @returns {Object} Image accessibility check result
 */
export const checkImageAccessibility = (images, accessibilityRules) => {
  if (!images || images.length === 0) {
    return {
      score: 100,
      violations: [],
      message: "No images to check",
    };
  }

  const requireAltText = accessibilityRules?.requireAltText !== false;
  const violations = [];

  if (requireAltText) {
    images.forEach((image, index) => {
      // Decorative images (like backgrounds) don't need alt text
      if (image.type === "background") return;

      if (!image.altText || image.altText.trim() === "") {
        violations.push({
          type: "accessibility",
          severity: "medium",
          description: `Image ${index + 1} (${
            image.type || "unknown"
          }) is missing alt text`,
          affectedElement: {
            imageIndex: index,
            type: image.type,
            dimensions: `${image.width}x${image.height}`,
          },
          suggestedFix: "Add descriptive alt text for screen readers",
          autoFixable: false,
        });
      }
    });
  }

  const imagesChecked = images.filter((i) => i.type !== "background").length;
  const score =
    imagesChecked > 0
      ? Math.round(((imagesChecked - violations.length) / imagesChecked) * 100)
      : 100;

  return {
    score,
    violations,
    imagesChecked,
    message:
      violations.length === 0
        ? "All images have appropriate alt text"
        : `${violations.length} image(s) missing alt text`,
  };
};

/**
 * Run full accessibility check on a design
 *
 * @param {Object} design - Design object with text content, images, and colors
 * @param {Object} accessibilityRules - Brand kit accessibility rules
 * @returns {Object} Full accessibility compliance report
 */
export const checkDesignAccessibility = (design, accessibilityRules) => {
  const allViolations = [];
  let textScore = 100;
  let imageScore = 100;

  // Check text accessibility
  if (design.textContent && design.textContent.length > 0) {
    const textResults = design.textContent.map((text) =>
      checkTextAccessibility(text, design.backgroundColor, accessibilityRules)
    );

    textResults.forEach((result) => {
      allViolations.push(...result.violations);
    });

    const compliantText = textResults.filter((r) => r.isCompliant).length;
    textScore = Math.round((compliantText / design.textContent.length) * 100);
  }

  // Check image accessibility
  if (design.images && design.images.length > 0) {
    const imageResult = checkImageAccessibility(
      design.images,
      accessibilityRules
    );
    allViolations.push(...imageResult.violations);
    imageScore = imageResult.score;
  }

  // Calculate overall score (weighted)
  const overallScore = Math.round(textScore * 0.7 + imageScore * 0.3);

  return {
    score: overallScore,
    violations: allViolations,
    textScore,
    imageScore,
    isCompliant: allViolations.length === 0,
    message:
      allViolations.length === 0
        ? "Design meets accessibility requirements"
        : `${allViolations.length} accessibility issue(s) need attention`,
  };
};

// Export service object
export default {
  calculateContrastRatio,
  calculateLuminance,
  checkContrastCompliance,
  checkTextAccessibility,
  checkImageAccessibility,
  checkDesignAccessibility,
};
