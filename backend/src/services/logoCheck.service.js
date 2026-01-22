/**
 * =============================================================================
 * Epsilon - Logo Check Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service handles logo-related compliance checking including:
 * - Minimum size validation
 * - Aspect ratio verification
 * - Clear space requirements
 * - Background color compatibility
 *
 * LOGO GUIDELINES:
 * Logos are brand-critical elements. Common violations include:
 * - Logo too small to be recognizable
 * - Distorted aspect ratio
 * - Insufficient clear space around logo
 * - Placed on incompatible backgrounds
 */

import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// LOGO CHECKING SERVICE
// ---------------------------------------------------------------------------

/**
 * Check a single logo against brand guidelines
 *
 * @param {Object} logo - Logo element with width, height, and other properties
 * @param {Object} logoRules - Brand kit logo rules
 * @returns {Object} Check result with compliance status and details
 */
export const checkLogoCompliance = (logo, logoRules) => {
  if (!logo) {
    return {
      isCompliant: true,
      message: "No logo to check",
    };
  }

  const violations = [];
  const details = {};

  // Default rules if not specified
  const rules = {
    minWidth: logoRules?.minWidth || 50,
    minHeight: logoRules?.minHeight || 50,
    clearSpaceRatio: logoRules?.clearSpaceRatio || 0.1,
    aspectRatioTolerance: logoRules?.aspectRatioTolerance || 0.05,
    allowedBackgrounds: logoRules?.allowedBackgrounds || [],
  };

  // Check minimum width
  if (logo.width < rules.minWidth) {
    violations.push({
      type: "logo",
      severity: "high",
      description: `Logo width (${logo.width}px) is below minimum required (${rules.minWidth}px)`,
      affectedElement: {
        property: "width",
        value: logo.width,
        required: rules.minWidth,
      },
      suggestedFix: { width: rules.minWidth },
      autoFixable: false,
    });
    details.widthCompliant = false;
  } else {
    details.widthCompliant = true;
  }

  // Check minimum height
  if (logo.height < rules.minHeight) {
    violations.push({
      type: "logo",
      severity: "high",
      description: `Logo height (${logo.height}px) is below minimum required (${rules.minHeight}px)`,
      affectedElement: {
        property: "height",
        value: logo.height,
        required: rules.minHeight,
      },
      suggestedFix: { height: rules.minHeight },
      autoFixable: false,
    });
    details.heightCompliant = false;
  } else {
    details.heightCompliant = true;
  }

  // Check aspect ratio (if original aspect ratio is known)
  if (logo.originalWidth && logo.originalHeight) {
    const originalRatio = logo.originalWidth / logo.originalHeight;
    const currentRatio = logo.width / logo.height;
    const ratioDifference =
      Math.abs(originalRatio - currentRatio) / originalRatio;

    if (ratioDifference > rules.aspectRatioTolerance) {
      violations.push({
        type: "logo",
        severity: "high",
        description: `Logo aspect ratio has been distorted (${Math.round(
          ratioDifference * 100
        )}% deviation)`,
        affectedElement: {
          original: originalRatio.toFixed(2),
          current: currentRatio.toFixed(2),
        },
        suggestedFix: "Restore original aspect ratio",
        autoFixable: false,
      });
      details.aspectRatioCompliant = false;
    } else {
      details.aspectRatioCompliant = true;
    }
  }

  // Check clear space (if position and canvas info available)
  if (logo.position && logo.canvasWidth && logo.canvasHeight) {
    const requiredClearSpace =
      Math.min(logo.width, logo.height) * rules.clearSpaceRatio;

    const clearSpaceTop = logo.position.y;
    const clearSpaceLeft = logo.position.x;
    const clearSpaceRight = logo.canvasWidth - (logo.position.x + logo.width);
    const clearSpaceBottom =
      logo.canvasHeight - (logo.position.y + logo.height);

    const violatedSides = [];
    if (clearSpaceTop < requiredClearSpace) violatedSides.push("top");
    if (clearSpaceLeft < requiredClearSpace) violatedSides.push("left");
    if (clearSpaceRight < requiredClearSpace) violatedSides.push("right");
    if (clearSpaceBottom < requiredClearSpace) violatedSides.push("bottom");

    if (violatedSides.length > 0) {
      violations.push({
        type: "logo",
        severity: "medium",
        description: `Logo lacks sufficient clear space on: ${violatedSides.join(
          ", "
        )}`,
        affectedElement: { sides: violatedSides, required: requiredClearSpace },
        suggestedFix: `Ensure at least ${Math.round(
          requiredClearSpace
        )}px clear space on all sides`,
        autoFixable: false,
      });
      details.clearSpaceCompliant = false;
    } else {
      details.clearSpaceCompliant = true;
    }
  }

  // Calculate overall compliance
  const isCompliant = violations.length === 0;
  const score = isCompliant ? 100 : Math.max(0, 100 - violations.length * 25);

  return {
    isCompliant,
    score,
    violations,
    details,
    message: isCompliant
      ? "Logo usage complies with brand guidelines"
      : `${violations.length} logo issue(s) detected`,
  };
};

/**
 * Check all logos in a design
 *
 * @param {Array} images - Array of image elements from the design
 * @param {Object} logoRules - Brand kit logo rules
 * @returns {Object} Full logo compliance report
 */
export const checkAllLogos = (images, logoRules) => {
  if (!images || images.length === 0) {
    return {
      score: 100,
      violations: [],
      logosFound: 0,
      message: "No images to check",
    };
  }

  // Filter only logo-type images
  const logos = images.filter((img) => img.type === "logo");

  if (logos.length === 0) {
    return {
      score: 100,
      violations: [],
      logosFound: 0,
      message: "No logos found in design",
    };
  }

  const allViolations = [];
  let totalScore = 0;

  logos.forEach((logo, index) => {
    const result = checkLogoCompliance(logo, logoRules);
    totalScore += result.score;

    // Add logo index to violations for identification
    result.violations.forEach((v) => {
      v.logoIndex = index;
      allViolations.push(v);
    });
  });

  const averageScore = Math.round(totalScore / logos.length);

  return {
    score: averageScore,
    violations: allViolations,
    logosFound: logos.length,
    logoCompliant: allViolations.length === 0,
    message:
      allViolations.length === 0
        ? `All ${logos.length} logo(s) comply with brand guidelines`
        : `${allViolations.length} logo issue(s) found in ${logos.length} logo(s)`,
  };
};

/**
 * Calculate minimum safe logo size based on canvas dimensions
 *
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {Object} logoRules - Brand kit logo rules
 * @returns {Object} Recommended minimum logo dimensions
 */
export const getRecommendedLogoSize = (
  canvasWidth,
  canvasHeight,
  logoRules
) => {
  const minWidth = logoRules?.minWidth || 50;
  const minHeight = logoRules?.minHeight || 50;

  // Logo should be at least 5% of canvas width for visibility
  const recommendedMinWidth = Math.max(
    minWidth,
    Math.round(canvasWidth * 0.05)
  );
  const recommendedMinHeight = Math.max(
    minHeight,
    Math.round(canvasHeight * 0.05)
  );

  return {
    minWidth: recommendedMinWidth,
    minHeight: recommendedMinHeight,
    recommendedWidth: Math.round(canvasWidth * 0.15), // 15% of canvas
    recommendedHeight: Math.round(canvasHeight * 0.15),
    maxWidth: Math.round(canvasWidth * 0.3), // 30% of canvas max
    maxHeight: Math.round(canvasHeight * 0.3),
  };
};

// Export service object
export default {
  checkLogoCompliance,
  checkAllLogos,
  getRecommendedLogoSize,
};
