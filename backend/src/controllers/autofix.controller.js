 /**
 * =============================================================================
 * Epsilon - Auto-Fix Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This controller handles automatic fix application for brand violations.
 * It uses the autoFix service to apply safe, reversible fixes to designs.
 *
 * ENDPOINTS:
 * - POST /api/autofix/apply   - Apply auto-fixes to a design
 * - POST /api/autofix/preview - Preview fixes without applying
 */

import Design from "../models/Design.js";
import AnalysisResult from "../models/AnalysisResult.js";
import autoFixService from "../services/autoFix.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Apply auto-fixes to a design
 *
 * @route POST /api/autofix/apply
 * @body {string} analysisId - ID of the analysis with violations
 * @body {string} designId - ID of the design to fix
 * @body {Array} fixTypes - Optional: specific fix types to apply (color, font, etc.)
 */
export const applyAutoFix = async (req, res, next) => {
  try {
    const { analysisId, designId, fixTypes } = req.body;

    // Validate input
    if (!analysisId && !designId) {
      return res
        .status(400)
        .json(errorResponse("Either analysisId or designId is required"));
    }

    // Fetch analysis result
    let analysis;
    let design;

    if (analysisId) {
      analysis = await AnalysisResult.findById(analysisId);
      if (!analysis) {
        return res.status(404).json(errorResponse("Analysis result not found"));
      }
      design = await Design.findById(analysis.designId);
    } else {
      design = await Design.findById(designId);
      if (!design) {
        return res.status(404).json(errorResponse("Design not found"));
      }
      // Get most recent analysis for this design
      analysis = await AnalysisResult.findOne({ designId }).sort({
        createdAt: -1,
      });

      if (!analysis) {
        return res
          .status(400)
          .json(
            errorResponse(
              "No analysis found for this design. Run analysis first."
            )
          );
      }
    }

    if (!design) {
      return res.status(404).json(errorResponse("Design not found"));
    }

    // Filter violations if specific fix types requested
    let violationsToFix = analysis.violations;
    if (fixTypes && Array.isArray(fixTypes)) {
      violationsToFix = violationsToFix.filter((v) =>
        fixTypes.includes(v.type)
      );
    }

    // Get auto-fixable violations only
    const autoFixableViolations = violationsToFix.filter((v) => v.autoFixable);

    if (autoFixableViolations.length === 0) {
      return res.json(
        successResponse(
          {
            fixedDesign: design.toAnalysisInput(),
            appliedFixes: [],
            skippedFixes: violationsToFix.map((v) => ({
              type: v.type,
              description: v.description,
              reason: v.autoFixable
                ? "Not included in fix types"
                : "Requires manual review",
            })),
            message: "No auto-fixable violations found",
          },
          "No fixes applied"
        )
      );
    }

    // Apply fixes
    const designData = design.toAnalysisInput();
    const fixResult = autoFixService.applyAutoFixes(
      designData,
      autoFixableViolations
    );

    if (!fixResult.success) {
      return res.status(500).json(errorResponse("Failed to apply fixes"));
    }

    logger.info(
      `Applied ${fixResult.appliedFixes.length} auto-fixes to design ${design._id}`
    );

    // Update design with fixed data (optional - uncomment to persist)
    // Object.assign(design, fixResult.fixedDesign);
    // await design.save();

    // Mark violations as resolved in analysis
    const resolvedViolationIds = fixResult.appliedFixes
      .map((fix) => {
        const matchingViolation = analysis.violations.find(
          (v) => v.type === fix.type && !v.resolved
        );
        if (matchingViolation) {
          matchingViolation.resolved = true;
          return matchingViolation._id;
        }
        return null;
      })
      .filter(Boolean);

    await analysis.save();

    res.json(
      successResponse(
        {
          fixedDesign: fixResult.fixedDesign,
          appliedFixes: fixResult.appliedFixes,
          skippedFixes: fixResult.skippedFixes,
          statistics: autoFixService.getFixStatistics(fixResult.appliedFixes),
          processingTime: fixResult.processingTime,
        },
        `Applied ${fixResult.appliedFixes.length} auto-fix(es) successfully`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Preview auto-fixes without applying
 *
 * @route POST /api/autofix/preview
 * @body {string} analysisId - ID of the analysis with violations
 */
export const previewAutoFix = async (req, res, next) => {
  try {
    const { analysisId } = req.body;

    if (!analysisId) {
      return res.status(400).json(errorResponse("Analysis ID is required"));
    }

    const analysis = await AnalysisResult.findById(analysisId);
    if (!analysis) {
      return res.status(404).json(errorResponse("Analysis result not found"));
    }

    const design = await Design.findById(analysis.designId);
    if (!design) {
      return res.status(404).json(errorResponse("Design not found"));
    }

    // Generate preview
    const preview = autoFixService.previewFixes(
      design.toAnalysisInput(),
      analysis.violations
    );

    res.json(
      successResponse(
        {
          preview,
          currentScore: analysis.complianceScore,
          violationsCount: analysis.violations.length,
        },
        "Auto-fix preview generated"
      )
    );
  } catch (error) {
    next(error);
  }
};

export default {
  applyAutoFix,
  previewAutoFix,
};
