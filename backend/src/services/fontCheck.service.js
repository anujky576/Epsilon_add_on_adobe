/**
 * =============================================================================
 * Epsilon - Font Check Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service handles all typography-related compliance checking including:
 * - Font family matching against approved list
 * - Font weight validation
 * - Fallback font suggestions
 * - Usage context validation (heading vs body fonts)
 *
 * FONT MATCHING STRATEGY:
 * - Case-insensitive matching for font names
 * - Supports both exact matches and fallback fonts
 * - Considers font weight when specified in brand guidelines
 */

import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// FONT UTILITIES
// ---------------------------------------------------------------------------

/**
 * Normalize font name for comparison
 * Removes extra whitespace, converts to lowercase
 * @param {string} fontName - Font name to normalize
 * @returns {string} Normalized font name
 */
export const normalizeFontName = (fontName) => {
  if (!fontName) return "";
  return fontName.trim().toLowerCase().replace(/\s+/g, " ");
};

/**
 * Check if two font names match (case-insensitive, whitespace-tolerant)
 * @param {string} font1 - First font name
 * @param {string} font2 - Second font name
 * @returns {boolean} True if fonts match
 */
export const fontsMatch = (font1, font2) => {
  return normalizeFontName(font1) === normalizeFontName(font2);
};

/**
 * Calculate similarity between two font names
 * Uses simple string similarity (Levenshtein-based)
 * @param {string} font1 - First font name
 * @param {string} font2 - Second font name
 * @returns {number} Similarity score 0-1 (1 = identical)
 */
export const calculateFontSimilarity = (font1, font2) => {
  const s1 = normalizeFontName(font1);
  const s2 = normalizeFontName(font2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // Simple word-based similarity
  const words1 = s1.split(" ");
  const words2 = s2.split(" ");

  let matches = 0;
  words1.forEach((w1) => {
    if (words2.some((w2) => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  });

  return matches / Math.max(words1.length, words2.length);
};

// ---------------------------------------------------------------------------
// FONT CHECKING SERVICE
// ---------------------------------------------------------------------------

/**
 * Check a single font against the brand typography
 *
 * @param {string} font - Font name from the design
 * @param {Array} brandFonts - Array of approved brand font objects
 * @param {string} [usageContext] - Optional usage context ('heading', 'body', 'accent')
 * @returns {Object} Check result with match status and details
 */
export const checkFontCompliance = (font, brandFonts, usageContext = null) => {
  const normalizedFont = normalizeFontName(font);

  if (!normalizedFont) {
    return {
      isCompliant: false,
      font: font,
      reason: "Invalid font name",
      suggestedFix: null,
    };
  }

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const brandFont of brandFonts) {
    // Check primary font name
    if (fontsMatch(font, brandFont.name)) {
      // If usage context matters, check if it matches
      if (usageContext && brandFont.usage && brandFont.usage !== "any") {
        if (brandFont.usage !== usageContext) {
          return {
            isCompliant: false,
            font: normalizedFont,
            reason: `Font "${font}" is approved but not for ${usageContext} usage`,
            matchedBrandFont: brandFont,
            suggestedFix: brandFonts.find(
              (f) => f.usage === usageContext || f.usage === "any"
            )?.name,
          };
        }
      }

      return {
        isCompliant: true,
        font: normalizedFont,
        matchedBrandFont: brandFont,
        matchType: "primary",
      };
    }

    // Check fallback fonts
    if (brandFont.fallbacks && Array.isArray(brandFont.fallbacks)) {
      for (const fallback of brandFont.fallbacks) {
        if (fontsMatch(font, fallback)) {
          return {
            isCompliant: true,
            font: normalizedFont,
            matchedBrandFont: brandFont,
            matchType: "fallback",
            fallbackOf: brandFont.name,
          };
        }
      }
    }

    // Track best match for suggestions
    const similarity = calculateFontSimilarity(font, brandFont.name);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = brandFont;
    }
  }

  // Font is not compliant
  return {
    isCompliant: false,
    font: normalizedFont,
    closestBrandFont: bestMatch,
    similarity: Math.round(bestSimilarity * 100) / 100,
    suggestedFix: bestMatch?.name || brandFonts[0]?.name,
  };
};

/**
 * Check all fonts in a design against brand guidelines
 *
 * @param {Array} designFonts - Array of font names used in the design
 * @param {Array} brandFonts - Array of brand font objects
 * @returns {Object} Full font compliance report
 */
export const checkAllFonts = (designFonts, brandFonts) => {
  if (!designFonts || designFonts.length === 0) {
    return {
      score: 100,
      violations: [],
      compliantFonts: [],
      message: "No fonts to check",
    };
  }

  if (!brandFonts || brandFonts.length === 0) {
    return {
      score: 0,
      violations: [
        {
          type: "font",
          severity: "medium",
          description: "No fonts defined in brand kit",
          affectedElement: null,
          suggestedFix: "Add typography guidelines to the brand kit",
        },
      ],
      compliantFonts: [],
      message: "Brand kit has no fonts defined",
    };
  }

  // Use Set to deduplicate fonts
  const uniqueFonts = [
    ...new Set(designFonts.map(normalizeFontName).filter(Boolean)),
  ];

  const violations = [];
  const compliantFonts = [];

  // Check each unique font
  uniqueFonts.forEach((font) => {
    const result = checkFontCompliance(font, brandFonts);

    if (result.isCompliant) {
      compliantFonts.push({
        font: result.font,
        matchedTo: result.matchedBrandFont?.name,
        matchType: result.matchType,
      });
    } else {
      violations.push({
        type: "font",
        severity: "medium",
        description:
          result.reason ||
          `Font "${font}" is not in the approved brand typography`,
        affectedElement: font,
        suggestedFix: result.suggestedFix,
        autoFixable: true,
        details: {
          closestMatch: result.closestBrandFont?.name,
          similarity: result.similarity,
        },
      });
    }
  });

  // Calculate score (percentage of compliant fonts)
  const score =
    uniqueFonts.length > 0
      ? Math.round((compliantFonts.length / uniqueFonts.length) * 100)
      : 100;

  return {
    score,
    violations,
    compliantFonts,
    totalChecked: uniqueFonts.length,
    message:
      violations.length === 0
        ? "All fonts are brand-compliant"
        : `${violations.length} font(s) need attention`,
  };
};

/**
 * Check text content for font compliance
 *
 * @param {Array} textContent - Array of text elements with font info
 * @param {Array} brandFonts - Array of brand font objects
 * @returns {Object} Text content font compliance report
 */
export const checkTextContentFonts = (textContent, brandFonts) => {
  if (!textContent || textContent.length === 0) {
    return {
      score: 100,
      violations: [],
      message: "No text content to check",
    };
  }

  const violations = [];
  const compliantCount = { heading: 0, body: 0, total: 0 };

  textContent.forEach((textElement, index) => {
    const font = textElement.font;
    if (!font) return;

    // Determine usage context based on font size
    const fontSize = textElement.fontSize || 16;
    const usageContext = fontSize >= 24 ? "heading" : "body";

    const result = checkFontCompliance(font, brandFonts, usageContext);

    if (result.isCompliant) {
      compliantCount[usageContext]++;
      compliantCount.total++;
    } else {
      violations.push({
        type: "font",
        severity: "medium",
        description:
          result.reason || `Text element uses unapproved font "${font}"`,
        affectedElement: {
          text:
            textElement.text?.substring(0, 50) +
            (textElement.text?.length > 50 ? "..." : ""),
          font: font,
          fontSize: fontSize,
        },
        suggestedFix: result.suggestedFix,
        autoFixable: true,
      });
    }
  });

  const totalText = textContent.filter((t) => t.font).length;
  const score =
    totalText > 0 ? Math.round((compliantCount.total / totalText) * 100) : 100;

  return {
    score,
    violations,
    compliantCount,
    totalChecked: totalText,
    message:
      violations.length === 0
        ? "All text uses brand-compliant fonts"
        : `${violations.length} text element(s) use non-compliant fonts`,
  };
};

/**
 * Get suggested font replacements for fixing violations
 *
 * @param {Array} violations - Array of font violations
 * @param {Array} brandFonts - Array of brand fonts
 * @returns {Array} Array of font fix suggestions
 */
export const getFontFixSuggestions = (violations, brandFonts) => {
  return violations
    .filter((v) => v.type === "font" && v.autoFixable)
    .map((violation) => ({
      original:
        typeof violation.affectedElement === "object"
          ? violation.affectedElement.font
          : violation.affectedElement,
      replacement: violation.suggestedFix,
      reason: `Replace with approved brand font`,
    }));
};

// Export service object
export default {
  checkFontCompliance,
  checkAllFonts,
  checkTextContentFonts,
  getFontFixSuggestions,
  normalizeFontName,
  fontsMatch,
};
