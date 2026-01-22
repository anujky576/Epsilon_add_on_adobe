/**
 * =============================================================================
 * Epsilon - Auto-Fix Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service handles automatic fix generation and application for brand
 * violations. It:
 * - Analyzes violations to determine fix strategies
 * - Generates fix recommendations
 * - Applies fixes to design JSON
 * - Tracks what was changed for reporting
 *
 * AUTO-FIXABLE VIOLATIONS:
 * - Color swaps (replace off-brand with closest brand color)
 * - Font replacements (replace with approved font)
 * - Text size adjustments (for accessibility)
 *
 * NON-AUTO-FIXABLE:
 * - Logo sizing (requires design judgment)
 * - Tone/language issues (requires human review)
 * - Layout changes (complex design decisions)
 */

import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// FIX GENERATORS
// ---------------------------------------------------------------------------

/**
 * Generate color fix
 * @param {Object} violation - Color violation object
 * @returns {Object} Fix specification
 */
const generateColorFix = (violation) => {
  if (!violation.suggestedFix) return null;

  return {
    type: "color",
    action: "replace",
    original: violation.affectedElement,
    replacement: violation.suggestedFix,
    description: `Replace color ${violation.affectedElement} with brand color ${violation.suggestedFix}`,
  };
};

/**
 * Generate font fix
 * @param {Object} violation - Font violation object
 * @returns {Object} Fix specification
 */
const generateFontFix = (violation) => {
  if (!violation.suggestedFix) return null;

  const originalFont =
    typeof violation.affectedElement === "object"
      ? violation.affectedElement.font
      : violation.affectedElement;

  return {
    type: "font",
    action: "replace",
    original: originalFont,
    replacement: violation.suggestedFix,
    description: `Replace font "${originalFont}" with approved font "${violation.suggestedFix}"`,
  };
};

/**
 * Generate accessibility fix
 * @param {Object} violation - Accessibility violation object
 * @returns {Object} Fix specification
 */
const generateAccessibilityFix = (violation) => {
  // Only auto-fix font size issues
  if (
    violation.description?.includes("font size") ||
    violation.description?.includes("Font size")
  ) {
    return {
      type: "fontSize",
      action: "increase",
      original: violation.affectedElement?.fontSize || 10,
      replacement: 12,
      description: "Increase font size to minimum 12px for readability",
    };
  }

  return null;
};

// ---------------------------------------------------------------------------
// AUTO-FIX SERVICE
// ---------------------------------------------------------------------------

/**
 * Generate fixes for a list of violations
 *
 * @param {Array} violations - Array of violation objects
 * @returns {Object} Fixes grouped by type with summary
 */
export const generateFixes = (violations) => {
  if (!violations || violations.length === 0) {
    return {
      fixes: [],
      autoFixableCount: 0,
      manualFixCount: 0,
      summary: "No violations to fix",
    };
  }

  const fixes = [];
  const manualReview = [];

  violations.forEach((violation) => {
    if (!violation.autoFixable) {
      manualReview.push({
        type: violation.type,
        description: violation.description,
        suggestedAction: violation.suggestedFix,
      });
      return;
    }

    let fix = null;

    switch (violation.type) {
      case "color":
        fix = generateColorFix(violation);
        break;
      case "font":
        fix = generateFontFix(violation);
        break;
      case "accessibility":
        fix = generateAccessibilityFix(violation);
        break;
      default:
        logger.warn(
          `No auto-fix handler for violation type: ${violation.type}`
        );
    }

    if (fix) {
      fixes.push(fix);
    }
  });

  return {
    fixes,
    autoFixableCount: fixes.length,
    manualFixCount: manualReview.length,
    manualReview,
    summary: `${fixes.length} auto-fix(es) available, ${manualReview.length} require manual review`,
  };
};

/**
 * Apply color fixes to design
 *
 * @param {Object} design - Design object to modify
 * @param {Array} colorFixes - Array of color fix specifications
 * @returns {Object} Modified design with applied fixes log
 */
const applyColorFixes = (design, colorFixes) => {
  const appliedFixes = [];

  if (!design.colorsUsed || colorFixes.length === 0) {
    return { design, appliedFixes };
  }

  const updatedColors = design.colorsUsed.map((color) => {
    const fix = colorFixes.find(
      (f) => f.original.toLowerCase() === color.toLowerCase()
    );

    if (fix) {
      appliedFixes.push({
        type: "color",
        before: color,
        after: fix.replacement,
        description: fix.description,
      });
      return fix.replacement;
    }

    return color;
  });

  design.colorsUsed = updatedColors;
  return { design, appliedFixes };
};

/**
 * Apply font fixes to design
 *
 * @param {Object} design - Design object to modify
 * @param {Array} fontFixes - Array of font fix specifications
 * @returns {Object} Modified design with applied fixes log
 */
const applyFontFixes = (design, fontFixes) => {
  const appliedFixes = [];

  if (fontFixes.length === 0) {
    return { design, appliedFixes };
  }

  // Fix fontsUsed array
  if (design.fontsUsed) {
    design.fontsUsed = design.fontsUsed.map((font) => {
      const fix = fontFixes.find(
        (f) => f.original.toLowerCase() === font.toLowerCase()
      );

      if (fix) {
        appliedFixes.push({
          type: "font",
          before: font,
          after: fix.replacement,
          description: fix.description,
        });
        return fix.replacement;
      }

      return font;
    });
  }

  // Fix textContent fonts
  if (design.textContent) {
    design.textContent = design.textContent.map((text) => {
      const fix = fontFixes.find(
        (f) => f.original.toLowerCase() === text.font?.toLowerCase()
      );

      if (fix) {
        // Only log once per unique font
        const alreadyLogged = appliedFixes.some(
          (af) => af.before === text.font && af.type === "font"
        );

        if (!alreadyLogged) {
          appliedFixes.push({
            type: "font",
            before: text.font,
            after: fix.replacement,
            description: fix.description,
          });
        }

        return { ...text, font: fix.replacement };
      }

      return text;
    });
  }

  return { design, appliedFixes };
};

/**
 * Apply font size fixes to design
 *
 * @param {Object} design - Design object to modify
 * @param {Array} fontSizeFixes - Array of font size fix specifications
 * @returns {Object} Modified design with applied fixes log
 */
const applyFontSizeFixes = (design, fontSizeFixes) => {
  const appliedFixes = [];

  if (!design.textContent || fontSizeFixes.length === 0) {
    return { design, appliedFixes };
  }

  design.textContent = design.textContent.map((text) => {
    if (text.fontSize && text.fontSize < 12) {
      appliedFixes.push({
        type: "fontSize",
        before: text.fontSize,
        after: 12,
        description: "Increased font size to 12px for accessibility",
      });
      return { ...text, fontSize: 12 };
    }
    return text;
  });

  return { design, appliedFixes };
};

/**
 * Apply all auto-fixes to a design
 *
 * @param {Object} design - Original design object
 * @param {Array} violations - Array of violations with fixes
 * @returns {Object} Result with fixed design and change log
 */
export const applyAutoFixes = (design, violations) => {
  const startTime = Date.now();

  // Generate fixes from violations
  const { fixes, manualReview } = generateFixes(violations);

  if (fixes.length === 0) {
    return {
      success: true,
      fixedDesign: design,
      appliedFixes: [],
      skippedFixes: manualReview,
      message: "No auto-fixes applied",
      processingTime: Date.now() - startTime,
    };
  }

  // Clone design to avoid mutation
  let fixedDesign = JSON.parse(JSON.stringify(design));
  const allAppliedFixes = [];

  // Group fixes by type
  const colorFixes = fixes.filter((f) => f.type === "color");
  const fontFixes = fixes.filter((f) => f.type === "font");
  const fontSizeFixes = fixes.filter((f) => f.type === "fontSize");

  // Apply fixes in order
  let result;

  result = applyColorFixes(fixedDesign, colorFixes);
  fixedDesign = result.design;
  allAppliedFixes.push(...result.appliedFixes);

  result = applyFontFixes(fixedDesign, fontFixes);
  fixedDesign = result.design;
  allAppliedFixes.push(...result.appliedFixes);

  result = applyFontSizeFixes(fixedDesign, fontSizeFixes);
  fixedDesign = result.design;
  allAppliedFixes.push(...result.appliedFixes);

  // Mark the design as having been auto-fixed
  fixedDesign._autoFixed = true;
  fixedDesign._fixedAt = new Date().toISOString();
  fixedDesign._fixCount = allAppliedFixes.length;

  logger.info(`Applied ${allAppliedFixes.length} auto-fixes to design`);

  return {
    success: true,
    fixedDesign,
    appliedFixes: allAppliedFixes,
    skippedFixes: manualReview,
    message: `Applied ${allAppliedFixes.length} auto-fix(es)`,
    processingTime: Date.now() - startTime,
  };
};

/**
 * Preview fixes without applying them
 *
 * @param {Object} design - Design object
 * @param {Array} violations - Array of violations
 * @returns {Object} Preview of what would be changed
 */
export const previewFixes = (design, violations) => {
  const { fixes, autoFixableCount, manualFixCount, manualReview, summary } =
    generateFixes(violations);

  return {
    summary,
    autoFixableCount,
    manualFixCount,
    fixes: fixes.map((fix) => ({
      type: fix.type,
      current: fix.original,
      proposed: fix.replacement,
      description: fix.description,
    })),
    manualReview,
    estimatedNewScore: null, // Would need re-analysis to calculate
  };
};

/**
 * Get fix statistics for reporting
 *
 * @param {Array} appliedFixes - Array of applied fix records
 * @returns {Object} Statistics about applied fixes
 */
export const getFixStatistics = (appliedFixes) => {
  if (!appliedFixes || appliedFixes.length === 0) {
    return {
      totalFixes: 0,
      byType: {},
    };
  }

  const byType = {};
  appliedFixes.forEach((fix) => {
    byType[fix.type] = (byType[fix.type] || 0) + 1;
  });

  return {
    totalFixes: appliedFixes.length,
    byType,
    types: Object.keys(byType),
    mostCommon: Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0],
  };
};

// Export service object
export default {
  generateFixes,
  applyAutoFixes,
  previewFixes,
  getFixStatistics,
};
